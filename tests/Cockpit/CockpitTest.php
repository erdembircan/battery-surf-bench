<?php
/**
 * Tests for the cockpit block + dashboard route manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Cockpit\Cockpit;
use ErdemBircan\BatterySurfBench\Cockpit\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

use function has_action;
use function has_filter;

/**
 * The cockpit registers its block and serves the dashboard off a URL parameter
 * — never a seeded page. Its observable contract: register the block from its
 * built directory, declare the dashboard query parameter, opt the `pages`
 * attribute into Block Bindings, and hook the dashboard route. The render-and-
 * exit path is exercised end-to-end in the Playground, not here.
 */
final class CockpitTest extends TestCase {

	private const BLOCK_DIR  = '/plugin/build/cockpit';
	private const BLOCK_NAME = 'bsb/cockpit';
	private const SOURCE     = 'bsb/course-pages';
	private const PARAM      = 'bsbSession';
	private const VALUE      = 'cockpit';
	private const CAPABILITY = 'manage_options';

	/**
	 * Builds the cockpit manager under test.
	 *
	 * @return Cockpit The manager.
	 */
	private function cockpit(): Cockpit {
		return new Cockpit(
			self::BLOCK_DIR,
			self::BLOCK_NAME,
			self::SOURCE,
			self::PARAM,
			self::VALUE,
			self::CAPABILITY,
			new CockpitDashboard()
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->cockpit() );
	}

	/**
	 * Registration opts `pages` into Block Bindings, declares the dashboard
	 * query var, and defers block registration and the route to their hooks.
	 */
	public function test_register_wires_bindings_query_var_block_and_route(): void {
		$cockpit = $this->cockpit();
		$cockpit->register();

		$this->assertNotFalse(
			has_filter( 'block_bindings_supported_attributes_' . self::BLOCK_NAME, array( $cockpit, 'allow_pages_binding' ) )
		);
		$this->assertNotFalse( has_filter( 'query_vars', array( $cockpit, 'add_query_var' ) ) );
		$this->assertNotFalse( has_action( 'init', array( $cockpit, 'register_block' ) ) );
		$this->assertNotFalse( has_action( 'template_redirect', array( $cockpit, 'maybe_render' ) ) );
	}

	/**
	 * The cockpit adds `pages` to the attributes WordPress may bind for the
	 * block; without it, the bound page list would be ignored.
	 */
	public function test_allow_pages_binding_adds_the_pages_attribute(): void {
		$this->assertSame( array( 'content', 'pages' ), $this->cockpit()->allow_pages_binding( array( 'content' ) ) );
	}

	/**
	 * The dashboard query parameter is added to the public query vars.
	 */
	public function test_add_query_var_registers_the_cockpit_param(): void {
		$this->assertSame( array( self::PARAM ), $this->cockpit()->add_query_var( array() ) );
	}

	/**
	 * The block is registered from its built directory, where its block.json,
	 * render template and view module live.
	 */
	public function test_register_block_registers_from_the_built_directory(): void {
		Functions\expect( 'register_block_type' )->once()->with( self::BLOCK_DIR );

		$this->cockpit()->register_block();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}
}
