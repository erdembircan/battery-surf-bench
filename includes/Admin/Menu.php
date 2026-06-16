<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Admin menu component.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin;

use ErdemBircan\BatterySurfBench\Support\Component;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the plugin's top-level admin menu and renders its landing page.
 */
class Menu implements Component {

	/**
	 * Slug that identifies the menu and its page in the admin.
	 */
	public const SLUG = 'battery-surf-bench';

	/**
	 * Capability required to see the menu.
	 */
	public const CAPABILITY = 'manage_options';

	/**
	 * URL of the menu icon shown in the admin sidebar.
	 *
	 * @var string
	 */
	private string $icon_url;

	/**
	 * Stores the menu icon URL. No work is done here so the component can be
	 * constructed without side effects.
	 *
	 * @param string $icon_url URL of the menu icon shown in the admin sidebar.
	 */
	public function __construct( string $icon_url ) {
		$this->icon_url = $icon_url;
	}

	/**
	 * Hooks the menu registration into the admin lifecycle.
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
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
