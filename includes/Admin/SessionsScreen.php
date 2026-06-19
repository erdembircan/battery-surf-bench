<?php
/**
 * Benchmark sessions listing screen.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function add_query_arg;
use function add_submenu_page;
use function esc_html__;
use function esc_url;
use function home_url;

defined( 'ABSPATH' ) || exit;

/**
 * Adds the DataViews-powered benchmark sessions listing under the plugin menu.
 *
 * The session post type is registered headless, with its admin list table
 * suppressed, so this screen owns the listing instead. It mounts a DataViews
 * grid that reads sessions straight from the post type's REST endpoint, and
 * hands the grid the session schema — localized as field descriptors — so the
 * listing's columns are driven by the same definition that registers the meta.
 *
 * All asset wiring goes through the {@see Assets} service; the screen never
 * touches WordPress' enqueue functions itself. The grid's script dependencies
 * come from the build manifest, so it binds to the editor packages WordPress
 * already provides; its bundled stylesheet declares `wp-components` as a
 * dependency, so the base styles load with it.
 */
class SessionsScreen implements Manager {

	/**
	 * The admin page hook the screen renders on, captured at registration so
	 * assets only load on this screen.
	 *
	 * @var string
	 */
	private string $hook_suffix = '';

	/**
	 * Stores the screen's placement, capability, data source, built assets and
	 * asset service.
	 *
	 * @param string        $parent_slug Slug of the menu the screen lives under.
	 * @param string        $page_slug   Slug that identifies the screen's page.
	 * @param string        $capability  Capability required to view the screen.
	 * @param string        $bundle         Built listing script, relative to the plugin root.
	 * @param string        $style          Bundle's stylesheet, relative to the plugin root.
	 * @param SessionSchema $schema         Source of the post type and field descriptors.
	 * @param Assets        $assets         Service used to register, localize and enqueue the bundle.
	 * @param string        $cockpit_param  Query parameter that opens the cockpit dashboard.
	 * @param string        $cockpit_value  Value of that parameter which serves the cockpit.
	 */
	public function __construct(
		private string $parent_slug,
		private string $page_slug,
		private string $capability,
		private string $bundle,
		private string $style,
		private SessionSchema $schema,
		private Assets $assets,
		private string $cockpit_param,
		private string $cockpit_value
	) {
	}

	/**
	 * Hooks the page registration and its asset loading into the admin lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Adds the listing as a submenu page and records its hook so assets load
	 * only there.
	 *
	 * @return void
	 */
	public function add_page(): void {
		$hook_suffix = add_submenu_page(
			$this->parent_slug,
			__( 'Benchmark Sessions', 'battery-surf-bench' ),
			__( 'Sessions', 'battery-surf-bench' ),
			$this->capability,
			$this->page_slug,
			array( $this, 'render' )
		);

		$this->hook_suffix = is_string( $hook_suffix ) ? $hook_suffix : '';
	}

	/**
	 * Loads the listing bundle, its data and its styles, but only on this
	 * screen. The bundle is registered, has the session schema localized onto it
	 * — so the grid builds its columns from the same definition that backs the
	 * meta — and its translations registered so its `@wordpress/i18n` strings
	 * localize, then enqueued; the stylesheet pulls in `wp-components` through its
	 * declared dependency. Every step is delegated to the asset service.
	 *
	 * @param string $hook_suffix The current admin page's hook.
	 * @return void
	 */
	public function enqueue( string $hook_suffix ): void {
		if ( '' === $this->hook_suffix || $hook_suffix !== $this->hook_suffix ) {
			return;
		}

		$handle = $this->assets->register_bundle( $this->bundle );
		$this->assets->localize( $handle, 'bsbSessions', $this->screen_config() );
		$this->assets->set_script_translations( $handle );
		$this->assets->enqueue_script( $handle );
		$this->assets->enqueue( $this->style, array( 'wp-components' ) );
	}

	/**
	 * Renders the screen: a wrapped heading, a link that opens the cockpit
	 * dashboard, and the container the bundle mounts the DataViews grid into.
	 *
	 * @return void
	 */
	public function render(): void {
		$cockpit_url = add_query_arg( $this->cockpit_param, $this->cockpit_value, home_url( '/' ) );

		printf(
			'<div class="wrap"><h1>%1$s <a href="%2$s" class="page-title-action">%3$s</a></h1><div id="bsb-sessions-app"></div></div>',
			esc_html__( 'Benchmark Sessions', 'battery-surf-bench' ),
			esc_url( $cockpit_url ),
			esc_html__( 'Open Cockpit', 'battery-surf-bench' )
		);
	}

	/**
	 * Builds the configuration the grid is localized with: the post type to
	 * query, the field descriptors, and the default visible columns.
	 *
	 * @return array<string, mixed> The screen configuration.
	 */
	private function screen_config(): array {
		return array(
			'postType'       => $this->schema->post_type(),
			'fields'         => $this->schema->fields(),
			'defaultColumns' => $this->schema->default_columns(),
		);
	}
}
