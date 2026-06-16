<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Tests for the asset enqueuing service.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Paths;
use InvalidArgumentException;

/**
 * Behavioral tests for the asset service's public contract.
 *
 * Versioning is verified against a real fixture file, since the contract the
 * service offers consumers is "the version is this file's content hash".
 */
final class AssetsTest extends TestCase {

	/**
	 * Directory holding the asset fixtures written per test.
	 *
	 * @var string
	 */
	private string $dir;

	/**
	 * Creates a fixture directory and points the path resolver at it.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->dir = sys_get_temp_dir() . '/bsb-assets-' . getmypid();
		if ( ! is_dir( $this->dir ) ) {
			mkdir( $this->dir, 0o777, true );
		}

		Functions\when( 'plugin_dir_path' )->justReturn( $this->dir . '/' );
	}

	/**
	 * Removes the fixture directory.
	 */
	protected function tearDown(): void {
		$files = glob( $this->dir . '/*' );
		foreach ( false === $files ? array() : $files as $file ) {
			unlink( $file );
		}
		if ( is_dir( $this->dir ) ) {
			rmdir( $this->dir );
		}

		parent::tearDown();
	}

	/**
	 * Writes an asset fixture and returns the content hash consumers expect as
	 * its version.
	 *
	 * @param string $name     File name to write under the fixture directory.
	 * @param string $contents File contents.
	 * @return string The fixture's content hash.
	 */
	private function fixture( string $name, string $contents ): string {
		file_put_contents( $this->dir . '/' . $name, $contents );

		return (string) hash_file( 'crc32b', $this->dir . '/' . $name );
	}

	/**
	 * A `.js` asset is enqueued as a script, in the footer, with a namespaced
	 * handle, its dependencies, and a content-hash version.
	 */
	public function test_enqueue_script_uses_namespaced_handle_and_hashed_version(): void {
		$version = $this->fixture( 'app.js', 'console.log( "surf" );' );

		Functions\when( 'plugins_url' )->justReturn( 'https://example.test/app.js' );
		Functions\expect( 'wp_enqueue_script' )
			->once()
			->with( 'battery-surf-bench-app', 'https://example.test/app.js', array( 'wp-element' ), $version, true );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/path/to/plugin.php' ) );
		$assets->enqueue( 'app.js', array( 'wp-element' ) );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * A `.css` asset is enqueued as a style, with a namespaced handle and a
	 * content-hash version.
	 */
	public function test_enqueue_style_uses_namespaced_handle_and_hashed_version(): void {
		$version = $this->fixture( 'app.css', 'body{margin:0;}' );

		Functions\when( 'plugins_url' )->justReturn( 'https://example.test/app.css' );
		Functions\expect( 'wp_enqueue_style' )
			->once()
			->with( 'battery-surf-bench-app', 'https://example.test/app.css', array(), $version );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/path/to/plugin.php' ) );
		$assets->enqueue( 'app.css' );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * The version changes when the file changes, so the browser never serves a
	 * stale asset.
	 */
	public function test_version_tracks_file_contents(): void {
		$first = $this->fixture( 'app.js', 'const a = 1;' );

		Functions\when( 'plugins_url' )->justReturn( 'https://example.test/app.js' );
		$captured = array();
		Functions\when( 'wp_enqueue_script' )->alias(
			static function ( $handle, $src, $deps, $ver ) use ( &$captured ) {
				$captured[] = $ver;
			}
		);

		$assets = new Assets( 'battery-surf-bench', new Paths( '/path/to/plugin.php' ) );
		$assets->enqueue( 'app.js' );

		$second = $this->fixture( 'app.js', 'const a = 2;' );
		$assets->enqueue( 'app.js' );

		$this->assertNotSame( $first, $second );
		$this->assertSame( array( $first, $second ), $captured );
	}

	/**
	 * An unsupported extension is rejected rather than enqueued with the wrong
	 * function.
	 */
	public function test_enqueue_rejects_unsupported_asset_type(): void {
		$assets = new Assets( 'battery-surf-bench', new Paths( '/path/to/plugin.php' ) );

		$this->expectException( InvalidArgumentException::class );
		$assets->enqueue( 'data.json' );
	}
}
