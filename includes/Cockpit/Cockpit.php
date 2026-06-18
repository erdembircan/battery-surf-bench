<?php
/**
 * Cockpit block + dashboard route.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function add_filter;
use function add_query_arg;
use function current_user_can;
use function do_blocks;
use function esc_html__;
use function esc_url;
use function generate_block_asset_handle;
use function get_query_var;
use function home_url;
use function nocache_headers;
use function register_block_type;
use function remove_all_actions;
use function sanitize_key;
use function sprintf;
use function wp_dequeue_script;
use function wp_dequeue_style;
use function wp_die;
use function wp_kses_post;
use function wp_login_url;
use function wp_script_modules;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the cockpit block and serves the dashboard it lives on off a URL
 * parameter (`?bsbSession=cockpit`) — never a seeded page. When that parameter
 * is hit by an administrator, the cockpit is rendered as a standalone document:
 * the classic style and script queues are emptied so no theme or other-plugin
 * CSS/JS gets in the dashboard's way — bar the cockpit's own stylesheet, which
 * is enqueued and spared — while the block's Interactivity API view (a script
 * module, a separate registry) is left to load and hydrate the viewport iframe.
 *
 * The block's `pages` attribute is fed the surfable course list through the
 * Block Bindings API. Custom block attributes are not bindable by default, so
 * the cockpit opts `pages` in via the per-block-type
 * `block_bindings_supported_attributes_{$name}` filter.
 */
class Cockpit implements Manager {

	/**
	 * Stores everything needed to register the block and serve its dashboard.
	 *
	 * @param string           $block_dir   Absolute path to the built block directory holding its `block.json`.
	 * @param string           $block_name  The block's registered name (e.g. `bsb/cockpit`).
	 * @param string           $source_name Bindings source name the `pages` attribute binds to.
	 * @param string           $param       Query parameter that selects the cockpit dashboard.
	 * @param string           $value       Value of the parameter that serves the cockpit.
	 * @param string           $capability  Capability required to open the cockpit.
	 * @param CockpitDashboard $dashboard  View that renders the standalone dashboard document.
	 * @param Assets           $assets      Service used to enqueue the dashboard stylesheet.
	 * @param string           $style       Dashboard stylesheet, relative to the plugin root.
	 */
	public function __construct(
		private string $block_dir,
		private string $block_name,
		private string $source_name,
		private string $param,
		private string $value,
		private string $capability,
		private CockpitDashboard $dashboard,
		private Assets $assets,
		private string $style
	) {
	}

	/**
	 * Handle the dashboard stylesheet was enqueued under, kept so the asset
	 * strip can spare it. Null until the stylesheet is enqueued.
	 *
	 * @var string|null
	 */
	private ?string $style_handle = null;

	/**
	 * Opts the `pages` attribute into Block Bindings, declares the dashboard
	 * query parameter, registers the block, and hooks the dashboard route.
	 *
	 * @return void
	 */
	public function register(): void {
		add_filter(
			'block_bindings_supported_attributes_' . $this->block_name,
			array( $this, 'allow_pages_binding' )
		);
		add_filter( 'query_vars', array( $this, 'add_query_var' ) );
		add_action( 'init', array( $this, 'register_block' ) );
		add_action( 'template_redirect', array( $this, 'maybe_render' ), 1 );
	}

	/**
	 * Registers the cockpit block from its built `block.json`, which wires in
	 * the server render template and the Interactivity API view module, then
	 * registers that module's translations so its `@wordpress/i18n` strings
	 * localize. The module id WordPress derives for the block's `viewScriptModule`
	 * is recomputed with core's own helper so it stays in step with however core
	 * names it.
	 *
	 * @return void
	 */
	public function register_block(): void {
		register_block_type( $this->block_dir );

		$this->assets->set_script_module_translations(
			generate_block_asset_handle( $this->block_name, 'viewScriptModule' )
		);
	}

	/**
	 * Declares the cockpit query parameter so WordPress parses it off the URL.
	 *
	 * @param array<int, string> $vars Registered public query vars.
	 * @return array<int, string> The query vars with the cockpit parameter added.
	 */
	public function add_query_var( array $vars ): array {
		$vars[] = $this->param;

		return $vars;
	}

	/**
	 * Adds the cockpit's `pages` attribute to the attributes the Block Bindings
	 * API may resolve for this block. Without this, WordPress only binds a fixed
	 * set of core block attributes and would ignore the binding.
	 *
	 * @param array<int, string> $attributes Attributes already bindable for the block.
	 * @return array<int, string> The attributes with `pages` added.
	 */
	public function allow_pages_binding( array $attributes ): array {
		$attributes[] = 'pages';

		return $attributes;
	}

	/**
	 * Serves the cockpit dashboard when its parameter is requested. Gated to the
	 * plugin capability; renders a standalone, theme-stripped document and exits.
	 *
	 * @return void
	 */
	public function maybe_render(): void {
		if ( $this->value !== $this->requested_value() ) {
			return;
		}

		if ( ! current_user_can( $this->capability ) ) {
			$this->deny();
		}

		$this->strip_front_end_assets();
		$this->send_headers();
		// The dashboard view returns a complete, trusted HTML document — escaped
		// attributes, do_blocks() output and wp_head()/wp_footer() — that no
		// WordPress escaping function can be applied to without breaking it.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-rendered document; see comment above.
		echo $this->dashboard->render( array( 'body' => do_blocks( $this->host_markup() ) ) );

		exit;
	}

	/**
	 * Resolves the cockpit parameter's value from the registered query parameter.
	 * The parameter is a public query var ({@see Cockpit::add_query_var()}), so
	 * WordPress parses it off the URL and exposes it through `get_query_var()` —
	 * no need to read the superglobal.
	 *
	 * @return string The sanitized value, or '' when the parameter is absent.
	 */
	private function requested_value(): string {
		return sanitize_key( (string) get_query_var( $this->param ) );
	}

	/**
	 * Strips the dashboard down to a clean slate. Everything hooked to
	 * `wp_head`/`wp_footer` is removed — theme font preloads, global styles,
	 * emoji, resource hints and the admin bar — then only the essential asset
	 * printers are re-added, and every classic style and script is dequeued. The
	 * Interactivity API script modules live in their own registry, so they are
	 * re-registered intact via {@see \WP_Script_Modules::add_hooks()} and still
	 * hydrate the viewport.
	 *
	 * @return void
	 */
	private function strip_front_end_assets(): void {
		add_filter( 'show_admin_bar', '__return_false' );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_style' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'dequeue_all_assets' ), PHP_INT_MAX );

		remove_all_actions( 'wp_head' );
		remove_all_actions( 'wp_footer' );

		add_action( 'wp_head', 'wp_enqueue_scripts', 1 );
		add_action( 'wp_head', 'wp_print_styles', 8 );
		add_action( 'wp_head', 'wp_print_head_scripts', 9 );
		add_action( 'wp_footer', 'wp_print_footer_scripts', 20 );

		// Re-register the script-module printers (import map, modules, module
		// data) core removed with the rest of the head/footer actions.
		wp_script_modules()->add_hooks();
	}

	/**
	 * Enqueues the dashboard stylesheet and records its handle so the asset
	 * strip can spare it. Hooked ahead of {@see Cockpit::dequeue_all_assets()},
	 * which would otherwise dequeue it along with everything else.
	 *
	 * @return void
	 */
	public function enqueue_style(): void {
		$this->style_handle = $this->assets->enqueue( $this->style );
	}

	/**
	 * Dequeues every classic style and script after the theme has enqueued, so
	 * none print on the dashboard — except the cockpit's own stylesheet, the one
	 * style the dashboard is meant to keep. Script modules are a separate
	 * registry and are left untouched.
	 *
	 * @return void
	 */
	public function dequeue_all_assets(): void {
		global $wp_styles, $wp_scripts;

		if ( $wp_styles instanceof \WP_Styles ) {
			foreach ( (array) $wp_styles->queue as $handle ) {
				if ( $handle === $this->style_handle ) {
					continue;
				}

				wp_dequeue_style( $handle );
			}
		}

		if ( $wp_scripts instanceof \WP_Scripts ) {
			foreach ( (array) $wp_scripts->queue as $handle ) {
				wp_dequeue_script( $handle );
			}
		}
	}

	/**
	 * Sends no-cache, no-index headers for the plugin-served dashboard.
	 *
	 * @return void
	 */
	private function send_headers(): void {
		if ( headers_sent() ) {
			return;
		}

		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow', true );
	}

	/**
	 * Builds the cockpit block markup, with its `pages` attribute bound to the
	 * course-pages source so the surfable page list is supplied server-side.
	 *
	 * @return string The serialized block markup.
	 */
	private function host_markup(): string {
		return sprintf(
			'<!-- wp:%s {"metadata":{"bindings":{"pages":{"source":"%s"}}}} /-->',
			$this->block_name,
			$this->source_name
		);
	}

	/**
	 * Denies access to a non-administrator with a login link back to the
	 * cockpit, then halts the request.
	 *
	 * @return void
	 */
	private function deny(): void {
		$login = wp_login_url( add_query_arg( $this->param, $this->value, home_url( '/' ) ) );

		wp_die(
			wp_kses_post(
				sprintf(
					/* translators: %s: login URL. */
					__( 'The cockpit requires an administrator. Please <a href="%s">log in</a>.', 'battery-surf-bench' ),
					esc_url( $login )
				)
			),
			esc_html__( 'Battery Surf Bench', 'battery-surf-bench' ),
			array( 'response' => 403 )
		);
	}
}
