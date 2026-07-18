<?php
/**
 * Tests for the service-recipe container.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Container;

use ErdemBircan\BatterySurfBench\Container\Definitions;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureEngine;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureNamed;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;

/**
 * Behavioral tests for the definitions container's public contract.
 */
final class DefinitionsTest extends TestCase {

	/**
	 * Consumers depend on the PSR-11 contract.
	 */
	public function test_implements_psr11_container_interface(): void {
		$this->assertInstanceOf( ContainerInterface::class, new Definitions( array() ) );
	}

	/**
	 * A registered recipe is returned verbatim.
	 */
	public function test_get_returns_the_recipe_for_a_defined_class(): void {
		$recipe      = array( 'args' => array( 'name' => 'surfer' ) );
		$definitions = new Definitions( array( FixtureNamed::class => $recipe ) );

		$this->assertSame( $recipe, $definitions->get( FixtureNamed::class ) );
	}

	/**
	 * `has` reflects whether a recipe was registered for a class.
	 */
	public function test_has_reports_registration_state(): void {
		$definitions = new Definitions( array( FixtureNamed::class => array() ) );

		$this->assertTrue( $definitions->has( FixtureNamed::class ) );
		$this->assertFalse( $definitions->has( FixtureEngine::class ) );
	}

	/**
	 * Requesting an undefined class surfaces the PSR-11 not-found error.
	 */
	public function test_get_throws_not_found_exception_for_undefined_class(): void {
		$definitions = new Definitions( array() );

		$this->expectException( NotFoundExceptionInterface::class );
		$definitions->get( FixtureEngine::class );
	}
}
