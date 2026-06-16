<?php
/**
 * Tests for the plugin path resolver.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Paths;

/**
 * Behavioral tests for the path resolver's public contract.
 */
final class PathsTest extends TestCase {

	/**
	 * A relative path resolves to a URL anchored at the plugin file, which is
	 * what consumers enqueue or link to.
	 */
	public function test_url_resolves_relative_path_against_plugin_file(): void {
		Functions\expect( 'plugins_url' )
			->once()
			->with( 'assets/app.js', '/path/to/plugin.php' )
			->andReturn( 'https://example.test/assets/app.js' );

		$paths = new Paths( '/path/to/plugin.php' );

		$this->assertSame( 'https://example.test/assets/app.js', $paths->url( 'assets/app.js' ) );
	}

	/**
	 * A relative path resolves to an absolute filesystem path under the plugin
	 * directory, which is what consumers read from disk.
	 */
	public function test_path_resolves_relative_path_under_plugin_dir(): void {
		Functions\when( 'plugin_dir_path' )->justReturn( '/var/www/plugins/battery-surf-bench/' );

		$paths = new Paths( '/var/www/plugins/battery-surf-bench/battery-surf-bench.php' );

		$this->assertSame(
			'/var/www/plugins/battery-surf-bench/assets/app.js',
			$paths->path( 'assets/app.js' )
		);
	}

	/**
	 * A leading slash on the relative path does not double up the separator.
	 */
	public function test_path_normalises_a_leading_slash(): void {
		Functions\when( 'plugin_dir_path' )->justReturn( '/var/www/plugins/battery-surf-bench/' );

		$paths = new Paths( '/var/www/plugins/battery-surf-bench/battery-surf-bench.php' );

		$this->assertSame(
			'/var/www/plugins/battery-surf-bench/assets/app.js',
			$paths->path( '/assets/app.js' )
		);
	}
}
