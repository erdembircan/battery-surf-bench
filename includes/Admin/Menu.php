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
	 * URL of the menu icon shown in the admin sidebar.
	 *
	 * @var string
	 */
	private string $icon_url;

	/**
	 * Handle under which the menu icon styling is enqueued.
	 *
	 * @var string
	 */
	private string $style_handle;

	/**
	 * Stores the menu's configuration. No work is done here so the manager can
	 * be constructed without side effects.
	 *
	 * @param string $slug         Slug that identifies the menu and its page.
	 * @param string $capability   Capability required to see the menu.
	 * @param string $icon_url     URL of the menu icon shown in the admin sidebar.
	 * @param string $style_handle Handle under which the menu icon styling is enqueued.
	 */
	public function __construct( string $slug, string $capability, string $icon_url, string $style_handle ) {
		$this->slug         = $slug;
		$this->capability   = $capability;
		$this->icon_url     = $icon_url;
		$this->style_handle = $style_handle;
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
	 * Enqueues the CSS that scales the high-resolution menu icon down to the
	 * sidebar size. Letting the browser scale a large source keeps the icon
	 * sharp on high-density displays, rather than shipping a blurry,
	 * pre-downsampled bitmap. The style is registered without a source, so the
	 * inline rules below carry it and no file version applies.
	 */
	public function enqueue_icon_style(): void {
		// phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- Src-less handle that only carries inline CSS; a file version is meaningless here.
		wp_register_style( $this->style_handle, false, array(), null );
		wp_enqueue_style( $this->style_handle );
		wp_add_inline_style( $this->style_handle, $this->icon_style() );
	}

	/**
	 * Builds the CSS that constrains the menu icon to the sidebar dimensions.
	 *
	 * @return string The icon styling rules.
	 */
	private function icon_style(): string {
		return sprintf(
			'#toplevel_page_%s .wp-menu-image img{width:20px;height:auto;}',
			$this->slug
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
