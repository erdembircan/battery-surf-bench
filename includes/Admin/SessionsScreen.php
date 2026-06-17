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
use function add_submenu_page;
use function esc_html__;
use function wp_add_inline_script;
use function wp_enqueue_script;
use function wp_enqueue_style;
use function wp_json_encode;

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
 * The grid's script dependencies come from the build manifest, so it binds to
 * the editor packages WordPress already provides. Its styles are the bundled
 * DataViews stylesheet (WordPress exposes no enqueueable handle for it) layered
 * on the `wp-components` base styles.
 */
class SessionsScreen implements Manager {

	/**
	 * The built listing bundle, relative to the plugin root.
	 *
	 * @var string
	 */
	private const BUNDLE = 'build/sessions.js';

	/**
	 * The bundle's extracted stylesheet, relative to the plugin root.
	 *
	 * @var string
	 */
	private const STYLE = 'build/style-sessions.css';

	/**
	 * The admin page hook the screen renders on, captured at registration so
	 * assets only load on this screen.
	 *
	 * @var string
	 */
	private string $hook_suffix = '';

	/**
	 * Stores the screen's placement, capability, data source and asset service.
	 *
	 * @param string        $parent_slug Slug of the menu the screen lives under.
	 * @param string        $page_slug   Slug that identifies the screen's page.
	 * @param string        $capability  Capability required to view the screen.
	 * @param SessionSchema $schema      Source of the post type and field descriptors.
	 * @param Assets        $assets      Service used to register and enqueue the bundle.
	 */
	public function __construct(
		private string $parent_slug,
		private string $page_slug,
		private string $capability,
		private SessionSchema $schema,
		private Assets $assets
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
	 * screen. The session schema is localized ahead of the bundle so the grid
	 * builds its columns from the same definition that backs the meta.
	 *
	 * @param string $hook_suffix The current admin page's hook.
	 * @return void
	 */
	public function enqueue( string $hook_suffix ): void {
		if ( '' === $this->hook_suffix || $hook_suffix !== $this->hook_suffix ) {
			return;
		}

		$handle = $this->assets->register_bundle( self::BUNDLE );

		wp_add_inline_script(
			$handle,
			'window.bsbSessions = ' . wp_json_encode( $this->screen_config() ) . ';',
			'before'
		);

		wp_enqueue_script( $handle );

		wp_enqueue_style( 'wp-components' );
		$this->assets->enqueue( self::STYLE, array( 'wp-components' ) );
	}

	/**
	 * Renders the screen: a wrapped heading and the container the bundle mounts
	 * the DataViews grid into.
	 *
	 * @return void
	 */
	public function render(): void {
		printf(
			'<div class="wrap"><h1>%s</h1><div id="bsb-sessions-app"></div></div>',
			esc_html__( 'Benchmark Sessions', 'battery-surf-bench' )
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
