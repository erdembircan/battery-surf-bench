<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Tests for the admin menu component.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Admin\Menu;
use ErdemBircan\BatterySurfBench\Support\Component;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

/**
 * Behavioral tests for the admin menu component's public contract.
 */
final class MenuTest extends TestCase {

	/**
	 * The bootstrap relies on every component honouring the contract.
	 */
	public function test_is_a_component(): void {
		$this->assertInstanceOf( Component::class, new Menu( 'https://example.test/icon.png', '1.2.3' ) );
	}

	/**
	 * Registering the component hooks its page onto the admin menu.
	 */
	public function test_register_hooks_page_onto_admin_menu(): void {
		$menu = new Menu( 'https://example.test/icon.png', '1.2.3' );
		$menu->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $menu, 'add_page' ) ) );
	}

	/**
	 * The page is added with the plugin's slug, capability and icon — the
	 * arguments WordPress uses to place and gate the menu.
	 */
	public function test_add_page_registers_top_level_menu_with_icon(): void {
		$icon = 'https://example.test/assets/images/menu-icon.png';
		$menu = new Menu( $icon, '1.2.3' );

		Functions\expect( 'add_menu_page' )
			->once()
			->with(
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				Menu::CAPABILITY,
				Menu::SLUG,
				array( $menu, 'render' ),
				$icon
			);

		$menu->add_page();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * Registering the component hooks its icon styling onto admin asset loading.
	 */
	public function test_register_hooks_icon_style_onto_admin_enqueue(): void {
		$menu = new Menu( 'https://example.test/icon.png', '1.2.3' );
		$menu->register();

		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $menu, 'enqueue_icon_style' ) ) );
	}

	/**
	 * The enqueued style scales the menu icon down to the sidebar size, which
	 * is what keeps the high-resolution source sharp.
	 */
	public function test_enqueue_icon_style_scales_the_menu_icon(): void {
		$menu = new Menu( 'https://example.test/icon.png', '1.2.3' );

		Functions\expect( 'wp_register_style' )->once()->with( Menu::STYLE_HANDLE, false, array(), '1.2.3' );
		Functions\expect( 'wp_enqueue_style' )->once()->with( Menu::STYLE_HANDLE );
		Functions\expect( 'wp_add_inline_style' )
			->once()
			->with(
				Menu::STYLE_HANDLE,
				Mockery::on(
					static function ( $css ) {
						return is_string( $css )
							&& str_contains( $css, '#toplevel_page_' . Menu::SLUG )
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
		$menu = new Menu( 'https://example.test/icon.png', '1.2.3' );

		ob_start();
		$menu->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( 'Battery Surf Bench', $output );
	}
}
