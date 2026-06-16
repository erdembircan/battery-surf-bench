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
use ErdemBircan\BatterySurfBench\Container\Container;

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
	 * Booting exposes the container so consumers can resolve shared services.
	 */
	public function test_init_exposes_container_with_plugin_file(): void {
		Functions\when( 'plugins_url' )->justReturn( 'https://example.test/assets/images/menu-icon.png' );

		$plugin = new BatterySurfBench( '/path/to/plugin.php' );
		$plugin->init();

		$this->assertInstanceOf( Container::class, $plugin->container() );
		$this->assertSame( '/path/to/plugin.php', $plugin->container()->get( BatterySurfBench::PLUGIN_FILE ) );
	}
}
