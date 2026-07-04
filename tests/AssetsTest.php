<?php
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
	 * Localizing hands the data to WordPress under the requested global name for
	 * the given handle, so callers pass script data through the asset service.
	 */
	public function test_localize_attaches_data_to_the_handle(): void {
		$data = array(
			'postType' => 'bsb_session',
			'fields'   => array( 'a', 'b' ),
		);

		Functions\expect( 'wp_localize_script' )
			->once()
			->with( 'battery-surf-bench-app', 'bsbSessions', $data );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$assets->localize( 'battery-surf-bench-app', 'bsbSessions', $data );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * Enqueuing by handle defers to WordPress for an already-registered script,
	 * so the register/localize/enqueue steps all pass through this service.
	 */
	public function test_enqueue_script_enqueues_a_registered_handle(): void {
		Functions\expect( 'wp_enqueue_script' )
			->once()
			->with( 'battery-surf-bench-sessions' );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$assets->enqueue_script( 'battery-surf-bench-sessions' );

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

	/**
	 * A classic script's translations are registered under the plugin's text
	 * domain — the same string as the handle namespace — and loaded from its
	 * bundled `languages` directory, so its `@wordpress/i18n` strings localize.
	 */
	public function test_set_script_translations_registers_domain_and_languages_path(): void {
		Functions\when( 'plugin_dir_path' )->justReturn( '/plugins/battery-surf-bench/' );

		Functions\expect( 'wp_set_script_translations' )
			->once()
			->with( 'battery-surf-bench-sessions', 'battery-surf-bench', '/plugins/battery-surf-bench/languages' );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$assets->set_script_translations( 'battery-surf-bench-sessions' );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * A script module's translations are registered through the dedicated module
	 * API, under the same text domain and bundled `languages` directory, so the
	 * Interactivity API view's strings localize too.
	 */
	public function test_set_script_module_translations_registers_domain_and_languages_path(): void {
		Functions\when( 'plugin_dir_path' )->justReturn( '/plugins/battery-surf-bench/' );

		Functions\expect( 'wp_set_script_module_translations' )
			->once()
			->with( 'bsb-cockpit-view-script-module', 'battery-surf-bench', '/plugins/battery-surf-bench/languages' );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$assets->set_script_module_translations( 'bsb-cockpit-view-script-module' );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * A script module is registered with a namespaced identifier, its declared
	 * dependencies, and the file hash as its version — the module counterpart of
	 * {@see Assets::register_bundle()}.
	 */
	public function test_register_script_module_uses_namespaced_id_deps_and_hash_version(): void {
		$this->stub_resolvers( 'a1b2c3d4', 'https://example.test/devtools/view.js' );

		Functions\expect( 'wp_register_script_module' )
			->once()
			->with(
				'battery-surf-bench-view',
				'https://example.test/devtools/view.js',
				array( '@wordpress/interactivity' ),
				'a1b2c3d4'
			);

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$id     = $assets->register_script_module( 'build/devtools/view.js', array( '@wordpress/interactivity' ) );

		$this->assertSame( 'battery-surf-bench-view', $id );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * Enqueuing by identifier defers to WordPress for an already-registered
	 * script module, the module counterpart of {@see Assets::enqueue_script()}.
	 */
	public function test_enqueue_script_module_enqueues_a_registered_id(): void {
		Functions\expect( 'wp_enqueue_script_module' )
			->once()
			->with( 'battery-surf-bench-view' );

		$assets = new Assets( 'battery-surf-bench', new Paths( '/plugins/battery-surf-bench/battery-surf-bench.php' ) );
		$assets->enqueue_script_module( 'battery-surf-bench-view' );

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}
}
