<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Tests for the plugin bootstrap.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\BatterySurfBench;

use function has_action;

/**
 * Behavioral tests for the bootstrap's public contract.
 */
final class BatterySurfBenchTest extends TestCase {

	/**
	 * Booting registers the plugin's components — observable here as the
	 * admin menu component hooking itself onto `admin_menu`.
	 */
	public function test_init_registers_components(): void {
		Functions\when( 'plugins_url' )->justReturn( 'https://example.test/assets/images/menu-icon.png' );

		$plugin = new BatterySurfBench( '/path/to/plugin.php' );
		$plugin->init();

		$this->assertNotFalse( has_action( 'admin_menu' ) );
	}

	/**
	 * Booting resolves the menu icon URL against the plugin file, so WordPress
	 * is pointed at the icon shipped with the plugin.
	 */
	public function test_init_resolves_icon_url_against_plugin_file(): void {
		Functions\expect( 'plugins_url' )
			->once()
			->with( 'assets/images/menu-icon.png', '/path/to/plugin.php' )
			->andReturn( 'https://example.test/assets/images/menu-icon.png' );

		$plugin = new BatterySurfBench( '/path/to/plugin.php' );
		$plugin->init();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}
}
