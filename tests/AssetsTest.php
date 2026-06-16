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
 * The service's job is to hand WordPress a namespaced handle, the right enqueue
 * function for the file type, and the file's hash as the version. The hashing
 * itself is PHP's job, so `hash_file` is stubbed — these tests assert the
 * wiring, not that crc32b hashes correctly.
 */
final class AssetsTest extends TestCase {

	/**
	 * Stubs the path and hash helpers the service leans on.
	 *
	 * @param string $version Hash the stubbed `hash_file` returns.
	 * @param string $url     URL the stubbed `plugins_url` returns.
	 */
	private function stub_resolvers( string $version, string $url ): void {
		Functions\when( 'plugins_url' )->justReturn( $url );
		Functions\when( 'plugin_dir_path' )->justReturn( '/plugins/battery-surf-bench/' );
		Functions\when( 'hash_file' )->justReturn( $version );
	}

	/**
	 * A `.js` asset is enqueued as a script, in the footer, with a namespaced
	 * handle, its dependencies, and the file hash as its version.
	 */
	public function test_enqueue_script_uses_namespaced_handle_footer_and_hash_version(): void {
		$this->stub_resolvers( 'a1b2c3d4', 'https://example.test/app.js' );

		Functions\expect( 'wp_enqueue_script' )
			->once()
			->with( 'battery-surf-bench-app', 'https://example.test/app.js', array( 'wp-element' ), 'a1b2c3d4', true );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$assets->enqueue( 'assets/app.js', array( 'wp-element' ) );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * A `.css` asset is enqueued as a style, with a namespaced handle and the
	 * file hash as its version.
	 */
	public function test_enqueue_style_uses_namespaced_handle_and_hash_version(): void {
		$this->stub_resolvers( 'a1b2c3d4', 'https://example.test/app.css' );

		Functions\expect( 'wp_enqueue_style' )
			->once()
			->with( 'battery-surf-bench-app', 'https://example.test/app.css', array(), 'a1b2c3d4' );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$assets->enqueue( 'assets/app.css' );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * An unsupported extension is rejected rather than enqueued with the wrong
	 * function.
	 */
	public function test_enqueue_rejects_unsupported_asset_type(): void {
		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );

		$this->expectException( InvalidArgumentException::class );
		$assets->enqueue( 'assets/data.json' );
	}
}
