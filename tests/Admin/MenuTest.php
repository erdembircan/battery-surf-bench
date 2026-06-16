<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Tests for the admin menu manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Admin\Menu;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the admin menu manager's public contract.
 */
final class MenuTest extends TestCase {

	private const SLUG         = 'battery-surf-bench';
	private const CAPABILITY   = 'manage_options';
	private const ICON_URL     = 'https://example.test/assets/images/menu-icon.png';
	private const STYLE_HANDLE = 'battery-surf-bench-admin-menu';

	/**
	 * Builds a menu manager with representative injected configuration.
	 *
	 * @return Menu The manager under test.
	 */
	private function menu(): Menu {
		return new Menu( self::SLUG, self::CAPABILITY, self::ICON_URL, self::STYLE_HANDLE );
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->menu() );
	}

	/**
	 * Registering the manager hooks its page onto the admin menu.
	 */
	public function test_register_hooks_page_onto_admin_menu(): void {
		$menu = $this->menu();
		$menu->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $menu, 'add_page' ) ) );
	}

	/**
	 * The page is added with the injected slug, capability and icon — the
	 * arguments WordPress uses to place and gate the menu.
	 */
	public function test_add_page_registers_top_level_menu_with_injected_config(): void {
		$menu = $this->menu();

		Functions\expect( 'add_menu_page' )
			->once()
			->with(
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				self::CAPABILITY,
				self::SLUG,
				array( $menu, 'render' ),
				self::ICON_URL
			);

		$menu->add_page();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * Registering the manager hooks its icon styling onto admin asset loading.
	 */
	public function test_register_hooks_icon_style_onto_admin_enqueue(): void {
		$menu = $this->menu();
		$menu->register();

		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $menu, 'enqueue_icon_style' ) ) );
	}

	/**
	 * The enqueued style scales the menu icon down to the sidebar size, which
	 * is what keeps the high-resolution source sharp. The style carries no
	 * source, so it is registered without a file version.
	 */
	public function test_enqueue_icon_style_scales_the_menu_icon(): void {
		$menu = $this->menu();

		Functions\expect( 'wp_register_style' )->once()->with( self::STYLE_HANDLE, false, array(), null );
		Functions\expect( 'wp_enqueue_style' )->once()->with( self::STYLE_HANDLE );
		Functions\expect( 'wp_add_inline_style' )
			->once()
			->with(
				self::STYLE_HANDLE,
				Mockery::on(
					static function ( $css ) {
						return is_string( $css )
							&& str_contains( $css, '#toplevel_page_' . self::SLUG )
							&& str_contains( $css, '.wp-menu-image img' );
					}
				)
			);

		$menu->enqueue_icon_style();

		// The Mockery expectations above are the assertions; acknowledge them
		// so PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * The page renders the plugin name — the only content for now.
	 */
	public function test_render_outputs_plugin_name(): void {
		$menu = $this->menu();

		ob_start();
		$menu->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( 'Battery Surf Bench', $output );
	}
}
