<?php
/**
 * Settings screen manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin;

use ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Support\Manager;
use WP_REST_Request;

use function __;
use function add_action;
use function add_menu_page;
use function add_query_arg;
use function get_option;
use function get_post_type;
use function get_the_title;
use function home_url;
use function implode;
use function is_array;
use function is_string;
use function rest_do_request;
use function rest_get_server;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the plugin's top-level admin menu and renders it as the settings
 * screen: a themed React app that lets a site owner build the surfer's test
 * page sequence from the plugin's bundled pages and their own posts and pages.
 *
 * This manager evolved from the plugin's former empty landing page (`Menu`):
 * it still owns the top-level `add_menu_page` registration and the menu-icon
 * stylesheet, and now also owns the settings bundle's asset wiring. The
 * surf-course order option is described by
 * {@see \ErdemBircan\BatterySurfBench\Course\CourseOrderOption} and actually
 * registered by {@see \ErdemBircan\BatterySurfBench\Settings\OptionRegistry},
 * the plugin's general options manager; this screen reads the option (healing
 * it through the same sanitizer on every read, since `register_setting`'s
 * sanitize callback only fires on write) and writes it through the core-data
 * site-settings entity (`/wp/v2/settings`) — no custom REST controller.
 */
class SettingsScreen implements Manager {

	/**
	 * Rows per page the internally-seeded Browse query fetches. Mirrors
	 * `PER_PAGE` in `src/settings/BrowsePane.tsx` exactly, so the seeded first
	 * page is byte-identical to what the client's own first fetch would
	 * return — keep both constants in sync.
	 */
	private const BROWSE_PER_PAGE = 10;

	/**
	 * The admin page hook the screen renders on, captured at registration so
	 * assets only load on this screen.
	 *
	 * @var string
	 */
	private string $hook_suffix = '';

	/**
	 * Stores the menu's placement, its assets, and the collaborators needed to
	 * describe and persist the surf-course order.
	 *
	 * @param string               $slug                  Slug that identifies the menu and its page.
	 * @param string               $capability            Capability required to see the menu.
	 * @param string               $icon_url              Menu icon: an image URL, Dashicon class, SVG data URI, or `none` to paint it via CSS.
	 * @param string               $icon_style            Plugin-relative path to the menu icon's stylesheet.
	 * @param string               $bundle                Built settings app script, relative to the plugin root.
	 * @param string               $style                 Bundle's stylesheet, relative to the plugin root.
	 * @param string               $option_name           Name of the option the surf-course order is saved under.
	 * @param array<string>        $selectable_post_types Post types the picker's browse pane may add from.
	 * @param CourseOrderSanitizer $sanitizer             Heals the saved order on every read — `register_setting`'s sanitize callback (the same sanitizer, wired into {@see \ErdemBircan\BatterySurfBench\Course\CourseOrderOption}'s definition and registered by {@see \ErdemBircan\BatterySurfBench\Settings\OptionRegistry}) only runs on write, so a stale saved order needs re-healing here too.
	 * @param CourseCatalog        $catalog               Source of the bundled page definitions.
	 * @param Assets               $assets                Service used to register, localize and enqueue the bundle.
	 * @param string               $cockpit_param         Query parameter that opens the cockpit dashboard.
	 * @param string               $cockpit_value         Value of that parameter which serves the cockpit.
	 */
	public function __construct(
		private string $slug,
		private string $capability,
		private string $icon_url,
		private string $icon_style,
		private string $bundle,
		private string $style,
		private string $option_name,
		private array $selectable_post_types,
		private CourseOrderSanitizer $sanitizer,
		private CourseCatalog $catalog,
		private Assets $assets,
		private string $cockpit_param,
		private string $cockpit_value
	) {
	}

	/**
	 * Hooks the menu registration and its asset loading into the WordPress
	 * lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_icon_style' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Adds the plugin's top-level page to the admin menu and records its hook
	 * so the settings bundle loads only there.
	 *
	 * @return void
	 */
	public function add_page(): void {
		$hook_suffix = add_menu_page(
			__( 'Battery Surf Bench', 'battery-surf-bench' ),
			__( 'Battery Surf Bench', 'battery-surf-bench' ),
			$this->capability,
			$this->slug,
			array( $this, 'render' ),
			$this->icon_url
		);

		$this->hook_suffix = is_string( $hook_suffix ) ? $hook_suffix : '';
	}

	/**
	 * Enqueues the stylesheet that paints the menu icon. Shipping it as a real
	 * file lets the browser cache it and lets the asset service version it by
	 * content hash.
	 *
	 * @return void
	 */
	public function enqueue_icon_style(): void {
		$this->assets->enqueue( $this->icon_style );
	}

	/**
	 * Loads the settings app bundle, its data and its styles, but only on this
	 * screen. The bundle is registered, has the screen configuration localized
	 * onto it, its translations registered so its `@wordpress/i18n` strings
	 * localize, then enqueued; the stylesheet pulls in `wp-components` through
	 * its declared dependency.
	 *
	 * @param string $hook_suffix The current admin page's hook.
	 * @return void
	 */
	public function enqueue( string $hook_suffix ): void {
		if ( '' === $this->hook_suffix || $hook_suffix !== $this->hook_suffix ) {
			return;
		}

		$handle = $this->assets->register_bundle( $this->bundle );
		$this->assets->localize( $handle, 'bsbSettings', $this->screen_config() );
		$this->assets->set_script_translations( $handle );
		$this->assets->enqueue_script( $handle );
		$this->assets->enqueue( $this->style, array( 'wp-components' ) );
	}

	/**
	 * Renders the settings screen: the coastal brand header, a link that opens
	 * the cockpit dashboard, and the container the bundle mounts the settings
	 * app into. The markup itself lives in {@see SettingsScreenView}; this only
	 * prepares the dynamic, already-escaped values and prints the finished view.
	 *
	 * @return void
	 */
	public function render(): void {
		$cockpit_url = add_query_arg( $this->cockpit_param, $this->cockpit_value, home_url( '/' ) );

		$markup = ( new SettingsScreenView() )->render(
			array(
				'title'         => __( 'Battery Surf Bench', 'battery-surf-bench' ),
				'subtitle'      => __( 'Settings', 'battery-surf-bench' ),
				'cockpit_url'   => $cockpit_url,
				'cockpit_label' => __( 'New Benchmark', 'battery-surf-bench' ),
			)
		);

		// The view escapes each value and returns finished, trusted markup, so the
		// assembled HTML cannot be run through an escaper here.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup; see comment above.
		echo $markup;
	}

	/**
	 * Builds the configuration the settings app is localized with: the
	 * selectable post types, the saved order, the bundled catalog the app
	 * folds into the sequence as locked rows, and each saved user page's
	 * title and type resolved server-side so the app paints titles on first
	 * render instead of a raw post id.
	 *
	 * The saved order is run through the sanitizer on every read, not only on
	 * write: `register_setting`'s `sanitize_callback` (the same sanitizer,
	 * wired into {@see \ErdemBircan\BatterySurfBench\Course\CourseOrderOption}'s
	 * definition and registered by
	 * {@see \ErdemBircan\BatterySurfBench\Settings\OptionRegistry}) only fires
	 * when the option is saved, so a stale order that predates a newly added
	 * bundled page — or still names a user id that has since become
	 * ineligible — would otherwise render unhealed until the next save.
	 * Healing on read here keeps every render consistent with what a save
	 * would produce.
	 *
	 * @return array<string, mixed> The screen configuration.
	 */
	private function screen_config(): array {
		$catalog = array();

		foreach ( $this->catalog->pages() as $page ) {
			$catalog[] = array(
				'slug'  => $page->slug(),
				'title' => $page->title(),
			);
		}

		$order = $this->sanitizer->sanitize( get_option( $this->option_name, $this->sanitizer->default_order() ) );

		return array(
			'postTypes'      => $this->selectable_post_types,
			'optionKey'      => $this->option_name,
			'courseOrder'    => $order,
			'bundledCatalog' => $catalog,
			'initialBrowse'  => $this->initial_browse(),
			'userPages'      => $this->resolve_user_pages( $order ),
		);
	}

	/**
	 * Resolves each saved user entry's title and post type server-side, so the
	 * settings app can paint a title on first render instead of a raw post id
	 * while the client-side resolver only has to catch up on whatever this
	 * could not seed. `$order` has already been healed by the sanitizer, so
	 * every `user` entry here is already known-eligible — no eligibility
	 * check is repeated here, only the title/type lookup.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $order The sanitized surf-course order.
	 * @return array<int, array{title: string, type: string}> Resolved title/type, keyed by post id.
	 */
	private function resolve_user_pages( array $order ): array {
		$pages = array();

		foreach ( $order as $entry ) {
			if ( 'user' !== $entry['kind'] ) {
				continue;
			}

			$id = $entry['id'];

			$pages[ $id ] = array(
				'title' => get_the_title( $id ),
				'type'  => (string) get_post_type( $id ),
			);
		}

		return $pages;
	}

	/**
	 * Runs the exact `/wp/v2/search` query the Browse pane's own first fetch
	 * would run, internally, so the localized seed is byte-identical to it —
	 * the app paints its first page from this instead of fetching it after
	 * mount. `rest_get_server()` lazily fires `rest_api_init` on first call
	 * (the same mechanism a real REST request relies on), so the search
	 * controller's route is registered even on a plain admin page load.
	 *
	 * @return array{records: array<int, array<string, mixed>>, totalItems: int, totalPages: int} The seeded first page.
	 */
	private function initial_browse(): array {
		$request = new WP_REST_Request( 'GET', '/wp/v2/search' );
		$request->set_query_params(
			array(
				'type'     => 'post',
				'subtype'  => implode( ',', $this->selectable_post_types ),
				'page'     => 1,
				'per_page' => self::BROWSE_PER_PAGE,
				'_fields'  => 'id,title,url,subtype',
			)
		);

		$response = rest_do_request( $request );
		$headers  = $response->get_headers();
		// response_to_data() (rather than the response's own get_data()) is what
		// applies the `_fields` trim, so the seed matches the client's own
		// fetch shape exactly.
		$records = rest_get_server()->response_to_data( $response, false );

		return array(
			'records'    => is_array( $records ) ? $records : array(),
			'totalItems' => isset( $headers['X-WP-Total'] ) ? (int) $headers['X-WP-Total'] : 0,
			'totalPages' => isset( $headers['X-WP-TotalPages'] ) ? (int) $headers['X-WP-TotalPages'] : 0,
		);
	}
}
