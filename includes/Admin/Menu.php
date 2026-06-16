<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Admin menu manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin;

use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function add_menu_page;
use function esc_html__;
use function wp_add_inline_style;
use function wp_enqueue_style;
use function wp_register_style;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the plugin's top-level admin menu and renders its landing page.
 */
class Menu implements Manager {

	/**
	 * Slug that identifies the menu and its page in the admin.
	 */
	public const SLUG = 'battery-surf-bench';

	/**
	 * Capability required to see the menu.
	 */
	public const CAPABILITY = 'manage_options';

	/**
	 * Handle under which the menu icon styling is enqueued.
	 */
	public const STYLE_HANDLE = 'battery-surf-bench-admin-menu';

	/**
	 * URL of the menu icon shown in the admin sidebar.
	 *
	 * @var string
	 */
	private string $icon_url;

	/**
	 * Version used to cache-bust the enqueued icon styling.
	 *
	 * @var string
	 */
	private string $version;

	/**
	 * Stores the menu icon URL and asset version. No work is done here so the
	 * manager can be constructed without side effects.
	 *
	 * @param string $icon_url URL of the menu icon shown in the admin sidebar.
	 * @param string $version  Version used to cache-bust the enqueued styling.
	 */
	public function __construct( string $icon_url, string $version ) {
		$this->icon_url = $icon_url;
		$this->version  = $version;
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
			self::CAPABILITY,
			self::SLUG,
			array( $this, 'render' ),
			$this->icon_url
		);
	}

	/**
	 * Enqueues the CSS that scales the high-resolution menu icon down to the
	 * sidebar size. Letting the browser scale a large source keeps the icon
	 * sharp on high-density displays, rather than shipping a blurry,
	 * pre-downsampled bitmap.
	 */
	public function enqueue_icon_style(): void {
		wp_register_style( self::STYLE_HANDLE, false, array(), $this->version );
		wp_enqueue_style( self::STYLE_HANDLE );
		wp_add_inline_style( self::STYLE_HANDLE, $this->icon_style() );
	}

	/**
	 * Builds the CSS that constrains the menu icon to the sidebar dimensions.
	 *
	 * @return string The icon styling rules.
	 */
	private function icon_style(): string {
		return sprintf(
			'#toplevel_page_%s .wp-menu-image img{width:20px;height:auto;}',
			self::SLUG
		);
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
