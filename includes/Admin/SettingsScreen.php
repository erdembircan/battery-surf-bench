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

use function __;
use function add_action;
use function add_menu_page;
use function add_query_arg;
use function get_option;
use function home_url;
use function is_string;
use function register_setting;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the plugin's top-level admin menu and renders it as the settings
 * screen: a themed React app that lets a site owner build the surfer's test
 * page sequence from the plugin's bundled pages and their own posts and pages.
 *
 * This manager evolved from the plugin's former empty landing page (`Menu`):
 * it still owns the top-level `add_menu_page` registration and the menu-icon
 * stylesheet, and now also owns the settings bundle's asset wiring and the
 * surf-course order option the app reads and writes through the core-data
 * site-settings entity (`/wp/v2/settings`) — no custom REST controller.
 */
class SettingsScreen implements Manager {

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
	 * @param CourseOrderSanitizer $sanitizer             Validates and heals the saved order.
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
	 * Hooks the menu registration, its asset loading and the surf-course order
	 * option into the WordPress lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_icon_style' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'init', array( $this, 'register_option' ) );
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
	 * Registers the surf-course order option with a REST schema wide enough to
	 * express its ordered, heterogeneous entries, so the settings app can read
	 * and write it through the core-data site-settings entity instead of a
	 * bespoke REST controller.
	 *
	 * @return void
	 */
	public function register_option(): void {
		register_setting(
			'bsb_settings',
			$this->option_name,
			array(
				'type'              => 'array',
				'description'       => __( "The surfer's test page sequence: bundled pages and the site owner's own posts and pages, in visit order.", 'battery-surf-bench' ),
				'default'           => $this->sanitizer->default_order(),
				'show_in_rest'      => array(
					'schema' => array(
						'type'  => 'array',
						'items' => array(
							'type'       => 'object',
							'properties' => array(
								'kind' => array(
									'type' => 'string',
									'enum' => array( 'bundled', 'user' ),
								),
								'slug' => array( 'type' => 'string' ),
								'id'   => array( 'type' => 'integer' ),
							),
						),
					),
				),
				'sanitize_callback' => array( $this->sanitizer, 'sanitize' ),
			)
		);
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
	 * selectable post types, the saved order, and the bundled catalog the app
	 * folds into the sequence as locked rows.
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

		return array(
			'postTypes'      => $this->selectable_post_types,
			'optionKey'      => $this->option_name,
			'courseOrder'    => get_option( $this->option_name, $this->sanitizer->default_order() ),
			'bundledCatalog' => $catalog,
		);
	}
}
