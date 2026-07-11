<?php
/**
 * Tests for the cockpit block + dashboard route manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Cockpit\Cockpit;
use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\StandaloneChrome;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;
use function has_filter;

/**
 * The cockpit registers its block and serves the dashboard off a URL parameter
 * — never a seeded page. Its observable contract: register the block from its
 * built directory, declare the dashboard query parameter, and hook the
 * dashboard route. The block carries no page data of its own — the client
 * builds each viewport request from index-route configuration the dashboard
 * route seeds (see {@see Cockpit::configure_rest_access()}), so there is no
 * Block Bindings wiring to test here. The standalone strip it delegates to is
 * covered by {@see StandaloneChromeTest}; the render-and-exit path (including
 * the seeded configuration) is exercised end-to-end in the Playground, not
 * here.
 */
final class CockpitTest extends TestCase {

	private const BLOCK_DIR    = '/plugin/build/cockpit';
	private const BLOCK_NAME   = 'bsb/cockpit';
	private const PARAM        = 'bsbSession';
	private const VALUE        = 'cockpit';
	private const CAPABILITY   = 'manage_options';
	private const STYLE        = 'build/style-cockpit-dashboard.css';
	private const POST_TYPE    = 'bsb_session';
	private const NONCE_ACTION = 'bsb_surf';

	/**
	 * Builds the cockpit manager under test.
	 *
	 * @param Assets|null $assets Asset service to inject; a dummy mock by default.
	 * @return Cockpit The manager.
	 */
	private function cockpit( ?Assets $assets = null ): Cockpit {
		$resolved = $assets ?? Mockery::mock( Assets::class );

		return new Cockpit(
			self::BLOCK_DIR,
			self::BLOCK_NAME,
			self::PARAM,
			self::VALUE,
			self::CAPABILITY,
			new CockpitDashboard(),
			$resolved,
			self::POST_TYPE,
			self::NONCE_ACTION,
			new StandaloneChrome( $resolved, self::STYLE )
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->cockpit() );
	}

	/**
	 * Registration declares the dashboard query var and defers block
	 * registration and the route to their hooks.
	 */
	public function test_register_wires_query_var_block_and_route(): void {
		$cockpit = $this->cockpit();
		$cockpit->register();

		$this->assertNotFalse( has_filter( 'query_vars', array( $cockpit, 'add_query_var' ) ) );
		$this->assertNotFalse( has_action( 'init', array( $cockpit, 'register_block' ) ) );
		$this->assertNotFalse( has_action( 'template_redirect', array( $cockpit, 'maybe_render' ) ) );
	}

	/**
	 * The dashboard query parameter is added to the public query vars.
	 */
	public function test_add_query_var_registers_the_cockpit_param(): void {
		$this->assertSame( array( self::PARAM ), $this->cockpit()->add_query_var( array() ) );
	}

	/**
	 * The block is registered from its built directory, where its block.json,
	 * render template and view module live, and the view module's translations
	 * are registered through the asset service so its strings localize. The
	 * module id is the one WordPress derives for the block's `viewScriptModule`.
	 */
	public function test_register_block_registers_the_block_and_its_module_translations(): void {
		Functions\expect( 'register_block_type' )->once()->with( self::BLOCK_DIR );
		Functions\when( 'generate_block_asset_handle' )->justReturn( 'bsb-cockpit-view-script-module' );

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'set_script_module_translations' )
			->once()
			->with( 'bsb-cockpit-view-script-module' );

		$this->cockpit( $assets )->register_block();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}
}
