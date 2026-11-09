<?php
/**
 * Start Benchmark menu entry.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin;

use ErdemBircan\BatterySurfBench\Admin\Views\StartBenchmarkView;
use ErdemBircan\BatterySurfBench\Core\Assets;
use ErdemBircan\BatterySurfBench\Support\AllowedHtml;
use ErdemBircan\BatterySurfBench\Support\CapabilityInterface;
use ErdemBircan\BatterySurfBench\Support\Manager;
use WP_Admin_Bar;

use function __;
use function add_action;
use function add_query_arg;
use function add_submenu_page;
use function esc_html__;
use function esc_url_raw;
use function home_url;
use function is_admin_bar_showing;
use function wp_kses;
use function wp_safe_redirect;

defined( 'ABSPATH' ) || exit;

/**
 * Adds a "Start Benchmark" entry to the plugin menu and the admin bar, both of
 * which jump straight to the cockpit dashboard in a new tab — the same
 * destination and behaviour as the Sessions screen's "Open Cockpit" link.
 *
 * The admin bar supports `target=_blank` natively, so its node needs nothing
 * further. A submenu page cannot carry a full cockpit URL as its slug —
 * `add_submenu_page()` passes the slug through `plugin_basename()`, which
 * corrupts an absolute URL — so the submenu instead registers a real page
 * slug and redirects it server-side to the cockpit. That redirect is also the
 * no-JavaScript fallback; a tiny enqueued script progressively enhances the
 * rendered menu link itself to open in a new tab, matching the admin bar.
 */
class StartBenchmark implements Manager {

	/**
	 * The admin page hook the submenu renders on, captured at registration so
	 * the redirect only fires for this page's own `load-*` hook.
	 *
	 * @var string
	 */
	private string $hook_suffix = '';

	/**
	 * Stores the entry's placement, capability, cockpit destination, nav script
	 * and asset service.
	 *
	 * @param string              $parent_slug   Slug of the menu the submenu lives under.
	 * @param string              $page_slug     Slug that identifies the submenu's page.
	 * @param CapabilityInterface $capability    Capability required to see the entry.
	 * @param string              $cockpit_param Query parameter that opens the cockpit dashboard.
	 * @param string              $cockpit_value Value of that parameter which serves the cockpit.
	 * @param string              $nav_script    Built script, relative to the plugin root, that
	 *                                          upgrades the rendered menu link to open in a new tab.
	 * @param string              $menu_style    Admin stylesheet, relative to the plugin root, that
	 *                                          carries the admin-bar node's icon rule.
	 * @param StartBenchmarkView  $view          Renders the no-redirect fallback page.
	 * @param Assets              $assets        Service used to register, localize and enqueue the script.
	 */
	public function __construct(
		private string $parent_slug,
		private string $page_slug,
		private CapabilityInterface $capability,
		private string $cockpit_param,
		private string $cockpit_value,
		private string $nav_script,
		private string $menu_style,
		private StartBenchmarkView $view,
		private Assets $assets
	) {
	}

	/**
	 * Hooks the submenu page, the admin bar node, the nav script and the
	 * admin-bar icon style into the admin (and, for the icon style, the
	 * front-end) lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_bar_menu', array( $this, 'add_bar_node' ), 80 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_bar_style' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_bar_style' ) );
	}

	/**
	 * Adds the entry as a submenu page, placed after Sessions, and hooks its
	 * own `load-*` action to redirect straight to the cockpit.
	 *
	 * @return void
	 */
	public function add_page(): void {
		$hook_suffix = add_submenu_page(
			$this->parent_slug,
			__( 'Start Benchmark', 'battery-surf-bench' ),
			__( 'Start Benchmark', 'battery-surf-bench' ),
			$this->capability->slug(),
			$this->page_slug,
			array( $this, 'render' )
		);

		$this->hook_suffix = is_string( $hook_suffix ) ? $hook_suffix : '';

		if ( '' !== $this->hook_suffix ) {
			add_action( "load-{$this->hook_suffix}", array( $this, 'redirect' ) );
		}
	}

	/**
	 * Sends the browser straight to the cockpit dashboard. This is the
	 * no-JavaScript fallback for the submenu link: whether a visitor lands on
	 * the page directly or clicks before the nav script upgrades the link,
	 * loading the page itself bounces them to the cockpit.
	 *
	 * @return void
	 */
	public function redirect(): void {
		wp_safe_redirect( $this->cockpit_url() );
		exit;
	}

	/**
	 * Renders the fallback page shown only if headers were already sent and the
	 * redirect could not fire. The markup itself lives in
	 * {@see StartBenchmarkView}; this only prepares the dynamic, raw values and
	 * prints the finished view.
	 *
	 * @return void
	 */
	public function render(): void {
		$markup = $this->view->render(
			array(
				'title'         => __( 'Start Benchmark', 'battery-surf-bench' ),
				'message'       => __( 'Opening the cockpit dashboard…', 'battery-surf-bench' ),
				'cockpit_url'   => $this->cockpit_url(),
				'cockpit_label' => __( 'Open Cockpit', 'battery-surf-bench' ),
			)
		);

		echo wp_kses( $markup, AllowedHtml::tags() );
	}

	/**
	 * Adds the admin bar node. Unlike the submenu link, the admin bar supports
	 * `target=_blank` natively, so no redirect or nav script is needed here.
	 *
	 * @param WP_Admin_Bar $wp_admin_bar The admin bar being built.
	 * @return void
	 */
	public function add_bar_node( WP_Admin_Bar $wp_admin_bar ): void {
		if ( ! $this->capability->allows() ) {
			return;
		}

		$wp_admin_bar->add_node(
			array(
				'id'    => 'bsbench-start-benchmark',
				'title' => esc_html__( 'Start Benchmark', 'battery-surf-bench' ),
				'href'  => esc_url_raw( $this->cockpit_url() ),
				'meta'  => array(
					'target' => '_blank',
					'rel'    => 'noopener noreferrer',
				),
			)
		);
	}

	/**
	 * Loads the tiny nav script that upgrades the rendered submenu link to
	 * open the cockpit in a new tab, matching the admin bar node. Enqueued on
	 * every admin page, since the menu is present on all of them and the
	 * script is negligible in size; it carries no user-facing strings, so no
	 * translations are registered for it.
	 *
	 * @return void
	 */
	public function enqueue(): void {
		$handle = $this->assets->register_bundle( $this->nav_script );
		$this->assets->localize(
			$handle,
			'bsbenchStartBenchmark',
			array(
				'menuSlug'    => $this->page_slug,
				'cockpitHref' => esc_url_raw( $this->cockpit_url() ),
			)
		);
		$this->assets->enqueue_script( $handle );
	}

	/**
	 * Loads the stylesheet that paints the admin-bar node's icon. The admin
	 * bar (and this node with it) renders on both the front end and the admin
	 * for a logged-in administrator, so this is hooked on both
	 * `admin_enqueue_scripts` and `wp_enqueue_scripts`; it loads only where
	 * the toolbar actually renders. It declares core's `admin-bar` style as a
	 * dependency so the icon rule lands after it. On admin pages the
	 * {@see SettingsScreen} manager already enqueues this same handle;
	 * WordPress dedupes by handle, so the double-enqueue is harmless.
	 *
	 * @return void
	 */
	public function enqueue_bar_style(): void {
		if ( ! is_admin_bar_showing() ) {
			return;
		}

		$this->assets->enqueue( $this->menu_style, array( 'admin-bar' ) );
	}

	/**
	 * Builds the cockpit dashboard URL.
	 *
	 * @return string The cockpit URL.
	 */
	private function cockpit_url(): string {
		return add_query_arg( $this->cockpit_param, $this->cockpit_value, home_url( '/' ) );
	}
}
