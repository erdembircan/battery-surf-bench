<?php
/**
 * Admin menu manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function add_menu_page;
use function esc_html__;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the plugin's top-level admin menu and renders its landing page.
 */
class Menu implements Manager {

	/**
	 * Slug that identifies the menu and its page in the admin.
	 *
	 * @var string
	 */
	private string $slug;

	/**
	 * Capability required to see the menu.
	 *
	 * @var string
	 */
	private string $capability;

	/**
	 * Icon shown in the admin sidebar. Any value WordPress accepts for a menu
	 * icon: an image URL, a Dashicon class, a base64 SVG data URI, or `none`
	 * to leave the icon empty for a stylesheet to paint.
	 *
	 * @var string
	 */
	private string $icon_url;

	/**
	 * Plugin-relative path to the stylesheet that paints the menu icon.
	 *
	 * @var string
	 */
	private string $style;

	/**
	 * Service used to enqueue the menu's stylesheet.
	 *
	 * @var Assets
	 */
	private Assets $assets;

	/**
	 * Stores the menu's configuration. No work is done here so the manager can
	 * be constructed without side effects.
	 *
	 * @param string $slug       Slug that identifies the menu and its page.
	 * @param string $capability Capability required to see the menu.
	 * @param string $icon_url   Menu icon: an image URL, Dashicon class, SVG
	 *                           data URI, or `none` to paint it via CSS.
	 * @param string $style      Plugin-relative path to the menu's stylesheet.
	 * @param Assets $assets     Service used to enqueue the menu's stylesheet.
	 */
	public function __construct( string $slug, string $capability, string $icon_url, string $style, Assets $assets ) {
		$this->slug       = $slug;
		$this->capability = $capability;
		$this->icon_url   = $icon_url;
		$this->style      = $style;
		$this->assets     = $assets;
	}

	/**
	 * Hooks the menu registration and icon styling into the admin lifecycle.
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_icon_style' ) );
	}

	/**
	 * Adds the plugin's top-level page to the admin menu.
	 */
	public function add_page(): void {
		add_menu_page(
			__( 'Battery Surf Bench', 'battery-surf-bench' ),
			__( 'Battery Surf Bench', 'battery-surf-bench' ),
			$this->capability,
			$this->slug,
			array( $this, 'render' ),
			$this->icon_url
		);
	}

	/**
	 * Enqueues the stylesheet that paints the menu icon. Shipping it as a real
	 * file lets the browser cache it and lets the asset service version it by
	 * content hash.
	 */
	public function enqueue_icon_style(): void {
		$this->assets->enqueue( $this->style );
	}

	/**
	 * Renders the menu page. For now it only names the plugin; the real
	 * dashboard is built on top of this later.
	 */
	public function render(): void {
		printf(
			'<div class="wrap"><h1>%s</h1></div>',
			esc_html__( 'Battery Surf Bench', 'battery-surf-bench' )
		);
	}
}
