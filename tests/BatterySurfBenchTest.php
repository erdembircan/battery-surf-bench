<?php
/**
 * Tests for the plugin bootstrap.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use ErdemBircan\BatterySurfBench\BatterySurfBench;
use ErdemBircan\BatterySurfBench\Container\Container;

/**
 * Behavioral tests for the bootstrap's public contract.
 */
final class BatterySurfBenchTest extends TestCase {

	/**
	 * The bootstrap exposes a PSR-11 container to consumers.
	 */
	public function test_exposes_a_container(): void {
		$plugin = new BatterySurfBench( '/path/to/plugin.php' );

		$this->assertInstanceOf( Container::class, $plugin->container() );
	}

	/**
	 * The plugin file path fed in at the entry point is its first container entry.
	 */
	public function test_seeds_container_with_plugin_file(): void {
		$plugin = new BatterySurfBench( '/var/www/plugins/battery-surf-bench/battery-surf-bench.php' );

		$this->assertSame(
			'/var/www/plugins/battery-surf-bench/battery-surf-bench.php',
			$plugin->container()->get( BatterySurfBench::PLUGIN_FILE )
		);
	}
}
