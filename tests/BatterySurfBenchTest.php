<?php
/**
 * Tests for the plugin bootstrap.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\BatterySurfBench;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the bootstrap's public contract.
 */
final class BatterySurfBenchTest extends TestCase {

	/**
	 * Stubs the path resolver's WordPress dependency. Booting composes the
	 * course and cockpit components, which resolve plugin-relative directories
	 * up front, so `plugin_dir_path` is exercised during `init()`.
	 */
	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'plugin_dir_path' )->justReturn( '/path/to/' );
		// The dev-tools manager gates its own registration on the environment;
		// default it closed (production) so booting never depends on it.
		Functions\when( 'wp_get_environment_type' )->justReturn( 'production' );
	}

	/**
	 * Booting registers the plugin's components — observable here as the
	 * admin menu component hooking itself onto `admin_menu`.
	 */
	public function test_init_registers_components(): void {
		$plugin = new BatterySurfBench( '/path/to/plugin.php' );
		$plugin->init();

		$this->assertNotFalse( has_action( 'admin_menu' ) );
	}

	/**
	 * Booting wires the translation loader, observable here as a callback hooked
	 * onto `init` — so the plugin's text domain is loaded once WordPress allows.
	 */
	public function test_init_wires_the_translation_loader(): void {
		$plugin = new BatterySurfBench( '/path/to/plugin.php' );
		$plugin->init();

		$this->assertNotFalse( has_action( 'init' ) );
	}

	/**
	 * The menu icon is configured as the literal `none` so the stylesheet can
	 * paint it. Booting must hand that value to the menu verbatim and never run
	 * it through `plugins_url`, which would otherwise point WordPress at a
	 * broken image URL ending in `/none`.
	 */
	public function test_init_does_not_resolve_the_css_painted_icon_to_a_url(): void {
		Functions\expect( 'plugins_url' )
			->with( 'none', Mockery::any() )
			->never();

		$plugin = new BatterySurfBench( '/path/to/plugin.php' );
		$plugin->init();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}
}
