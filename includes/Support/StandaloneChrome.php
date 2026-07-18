<?php
/**
 * Standalone-document chrome: strips the front end to a clean slate.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

use ErdemBircan\BatterySurfBench\Core\Assets;
use WP_Scripts;
use WP_Styles;

use function add_action;
use function add_filter;
use function apply_filters;
use function header;
use function headers_sent;
use function in_array;
use function nocache_headers;
use function remove_all_actions;
use function wp_dequeue_script;
use function wp_dequeue_style;
use function wp_script_modules;

defined( 'ABSPATH' ) || exit;

/**
 * Prepares a request to emit a standalone, theme-stripped HTML document — the
 * shared chrome behind both the cockpit dashboard and the session detail page.
 *
 * When engaged it empties everything hooked to `wp_head`/`wp_footer` (theme font
 * preloads, global styles, emoji, resource hints, the admin bar), re-adds only
 * the essential asset printers, and dequeues every classic style and script so
 * no theme or other-plugin CSS/JS reaches the page — sparing only the one
 * stylesheet the page is built on, any style handles the dev-tooling style
 * filter opts back in (the dev-tools panel stylesheet), and any script handles
 * the dev-tooling script filter opts back in (the Playground LiveReload
 * client). The Interactivity API script modules live in their own registry, so
 * they are re-registered intact and still hydrate. Headers go out no-cache,
 * no-index, as a plugin-served document should.
 *
 * One instance serves one page type: it is constructed with the stylesheet that
 * page keeps, so the page that owns it only renders its own body — this chrome
 * clears the stage around it.
 */
class StandaloneChrome {

	/**
	 * Stores the asset service and the page's kept stylesheet.
	 *
	 * @param Assets $assets Service used to enqueue (and so spare) the kept stylesheet.
	 * @param string $style  Stylesheet the stripped document keeps, relative to the plugin root.
	 */
	public function __construct(
		private Assets $assets,
		private string $style
	) {
	}

	/**
	 * Handle the kept stylesheet was enqueued under, so the strip can spare it.
	 * Null until the stylesheet is enqueued.
	 *
	 * @var string|null
	 */
	private ?string $style_handle = null;

	/**
	 * Engages the chrome for the current request: keeps the configured stylesheet
	 * and the script-module registry, strips everything else, and sends the
	 * standalone document's headers. Wires the enqueue/strip onto
	 * `wp_enqueue_scripts` (the strip last, so it runs after the theme has
	 * enqueued) and empties the head and footer hooks, re-adding only the asset
	 * printers.
	 *
	 * @return void
	 */
	public function engage(): void {
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

		$this->send_headers();
	}

	/**
	 * Enqueues the kept stylesheet and records its handle so the strip can spare
	 * it. Hooked ahead of {@see dequeue_all_assets()}, which would otherwise
	 * dequeue it along with everything else.
	 *
	 * @return void
	 */
	public function enqueue_style(): void {
		$this->style_handle = $this->assets->enqueue( $this->style );
	}

	/**
	 * Dequeues every classic style and script after the theme has enqueued, so
	 * none print on the standalone document — except the kept stylesheet (and any
	 * style handles opted out through the dev-tooling style filter) and any
	 * script handles opted out through the dev-tooling script filter (both empty
	 * by default; the Playground LiveReload client and the dev-tools panel use
	 * them to survive the strip). Script modules are a separate registry and are
	 * left untouched.
	 *
	 * @return void
	 */
	public function dequeue_all_assets(): void {
		global $wp_styles, $wp_scripts;

		if ( $wp_styles instanceof WP_Styles ) {
			/**
			 * Filters the classic style handles the standalone document keeps when
			 * it strips the front end. Empty by default — a standalone document
			 * wants no foreign CSS — but dev tooling (the dev-tools panel) hooks it
			 * so its stylesheet survives the strip on the cockpit dashboard.
			 *
			 * @param array<int, string> $handles Style handles to spare from the strip.
			 */
			$spared_styles = apply_filters( 'battery_surf_bench_cockpit_spared_style_handles', array() );

			foreach ( (array) $wp_styles->queue as $handle ) {
				if ( $handle === $this->style_handle || in_array( $handle, $spared_styles, true ) ) {
					continue;
				}

				wp_dequeue_style( $handle );
			}
		}

		if ( $wp_scripts instanceof WP_Scripts ) {
			/**
			 * Filters the classic script handles the standalone document keeps when
			 * it strips the front end. Empty by default — a standalone document
			 * wants no classic JS — but dev tooling (e.g. the Playground LiveReload
			 * client) hooks it so the script survives the strip and file changes
			 * still reload the page in place.
			 *
			 * @param array<int, string> $handles Script handles to spare from the strip.
			 */
			$spared = apply_filters( 'battery_surf_bench_cockpit_spared_script_handles', array() );

			foreach ( (array) $wp_scripts->queue as $handle ) {
				if ( in_array( $handle, $spared, true ) ) {
					continue;
				}

				wp_dequeue_script( $handle );
			}
		}
	}

	/**
	 * Sends no-cache, no-index headers for the plugin-served document.
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
}
