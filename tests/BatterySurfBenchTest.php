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
use ReflectionClass;

/**
 * Behavioral tests for the bootstrap's public contract.
 */
final class BatterySurfBenchTest extends TestCase {

	/**
	 * Resets the bootstrap singleton between tests so each test starts clean.
	 *
	 * Reflection is used purely for teardown cleanup, never for assertions.
	 */
	protected function tearDown(): void {
		$property = ( new ReflectionClass( BatterySurfBench::class ) )->getProperty( 'instance' );
		$property->setValue( null, null );

		parent::tearDown();
	}

	/**
	 * Consumers rely on getting the same shared instance back.
	 */
	public function test_initialize_returns_same_instance(): void {
		$first  = BatterySurfBench::initialize( '/path/to/plugin.php' );
		$second = BatterySurfBench::initialize( '/path/to/plugin.php' );

		$this->assertSame( $first, $second );
	}

	/**
	 * The bootstrap exposes a PSR-11 container to consumers.
	 */
	public function test_exposes_a_container(): void {
		$plugin = BatterySurfBench::initialize( '/path/to/plugin.php' );

		$this->assertInstanceOf( Container::class, $plugin->container() );
	}

	/**
	 * The plugin file path fed in at the entry point is its first container entry.
	 */
	public function test_seeds_container_with_plugin_file(): void {
		$plugin = BatterySurfBench::initialize( '/var/www/plugins/battery-surf-bench/battery-surf-bench.php' );

		$this->assertSame(
			'/var/www/plugins/battery-surf-bench/battery-surf-bench.php',
			$plugin->container()->get( BatterySurfBench::PLUGIN_FILE )
		);
	}
}
