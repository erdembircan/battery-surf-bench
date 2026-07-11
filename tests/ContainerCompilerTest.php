<?php
/**
 * Tests for the build-time container-definition plan compiler.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use ErdemBircan\BatterySurfBench\ContainerCompiler;
use ErdemBircan\BatterySurfBench\Paths;
use ErdemBircan\BatterySurfBench\Registry;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureBundle;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureCar;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureConsoleLogger;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureEngine;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureListing;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureNamed;

/**
 * Behavioral tests for the compiler's public contract: `compile()` as a
 * pure function over a small hand-built service-recipe map, fixture
 * classes, and an in-memory {@see Registry} — no filesystem involved, since
 * writing the compiled output to disk is `bin/BuildContainer.php`'s job,
 * not this class's. Assertions target the plan instructions a compiled
 * class ends up with, not real managers.
 */
final class ContainerCompilerTest extends TestCase {

	/**
	 * A `%token%` arg compiles to a `value` instruction carrying the
	 * literal registry value.
	 */
	public function test_compile_resolves_a_token_arg_to_a_value_instruction(): void {
		$registry = new Registry( array( 'surfer' => array( 'name' => 'kai' ) ) );
		$services = array(
			FixtureNamed::class => array( 'args' => array( 'name' => '%surfer.name%' ) ),
		);

		$compiled = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame( array( array( 'value', 'kai' ) ), $compiled[ FixtureNamed::class ]['plan'] );
	}

	/**
	 * An autowired concrete dependency compiles to a `make` instruction, and
	 * the dependency class itself — reachable only through that
	 * instruction, never listed in the original recipes — is planned too and
	 * appears in the output map with an empty plan (its own constructor
	 * takes no arguments).
	 */
	public function test_compile_resolves_an_autowired_dependency_and_walks_the_closure(): void {
		$registry = new Registry( array() );
		$services = array( FixtureCar::class => array() );

		$compiled = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame( array( array( 'make', FixtureEngine::class ) ), $compiled[ FixtureCar::class ]['plan'] );
		$this->assertArrayHasKey( FixtureEngine::class, $compiled );
		$this->assertSame(
			array(
				'plan'   => array(),
				'shared' => true,
			),
			$compiled[ FixtureEngine::class ]
		);
	}

	/**
	 * A `%token%` arg resolving to a list-array config value compiles to a
	 * `value` instruction carrying that array directly — the Registry
	 * returns list values whole, with no wrapper spec involved.
	 */
	public function test_compile_bakes_a_token_list_array_into_a_value_instruction(): void {
		$registry = new Registry( array( 'surf' => array( 'pages' => array( 'article-1', 'gallery' ) ) ) );
		$services = array(
			FixtureListing::class => array( 'args' => array( 'items' => '%surf.pages%' ) ),
		);

		$compiled = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame(
			array( array( 'value', array( 'article-1', 'gallery' ) ) ),
			$compiled[ FixtureListing::class ]['plan']
		);
	}

	/**
	 * A `runtime` spec compiles to a `runtime` instruction carrying the
	 * runtime key verbatim — it is resolved against the seeded runtime
	 * literals at `make()` time, never at compile time.
	 */
	public function test_compile_preserves_a_runtime_spec_as_a_runtime_instruction(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureNamed::class => array( 'args' => array( 'name' => array( 'runtime' => 'plugin_file' ) ) ),
		);

		$compiled = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame( array( array( 'runtime', 'plugin_file' ) ), $compiled[ FixtureNamed::class ]['plan'] );
	}

	/**
	 * A `path` spec compiles to a `path` instruction carrying the already
	 * baked relative path — and, since executing a `path` instruction calls
	 * `Paths::path()` at runtime, {@see Paths} itself is walked into the
	 * closure and planned too.
	 */
	public function test_compile_bakes_a_path_spec_and_walks_paths_into_the_closure(): void {
		$registry = new Registry( array( 'cockpit' => array( 'dir' => 'build/cockpit' ) ) );
		$services = array(
			FixtureNamed::class => array( 'args' => array( 'name' => array( 'path' => '%cockpit.dir%' ) ) ),
			Paths::class        => array( 'args' => array( 'plugin_file' => array( 'runtime' => 'plugin_file' ) ) ),
		);

		$compiled = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame( array( array( 'path', 'build/cockpit' ) ), $compiled[ FixtureNamed::class ]['plan'] );
		$this->assertArrayHasKey( Paths::class, $compiled );
		$this->assertSame( array( array( 'runtime', 'plugin_file' ) ), $compiled[ Paths::class ]['plan'] );
	}

	/**
	 * A `services` spec compiles to a `services` instruction carrying the
	 * class list verbatim, and each referenced class is walked into the
	 * closure and planned too.
	 */
	public function test_compile_preserves_a_services_spec_and_walks_its_classes(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureBundle::class => array(
				'args' => array( 'components' => array( 'services' => array( FixtureConsoleLogger::class ) ) ),
			),
		);

		$compiled = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame(
			array( array( 'services', array( FixtureConsoleLogger::class ) ) ),
			$compiled[ FixtureBundle::class ]['plan']
		);
		$this->assertArrayHasKey( FixtureConsoleLogger::class, $compiled );
		$this->assertSame(
			array(
				'plan'   => array(),
				'shared' => true,
			),
			$compiled[ FixtureConsoleLogger::class ]
		);
	}

	/**
	 * `'shared' => false` on a recipe carries through to the compiled plan
	 * entry.
	 */
	public function test_compile_preserves_a_non_shared_recipe(): void {
		$registry = new Registry( array() );
		$services = array( FixtureEngine::class => array( 'shared' => false ) );

		$compiled = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertFalse( $compiled[ FixtureEngine::class ]['shared'] );
	}
}
