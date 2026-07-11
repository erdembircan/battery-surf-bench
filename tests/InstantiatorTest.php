<?php
/**
 * Tests for the reflection-based service builder.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Definitions;
use ErdemBircan\BatterySurfBench\InstanceStore;
use ErdemBircan\BatterySurfBench\Instantiator;
use ErdemBircan\BatterySurfBench\Paths;
use ErdemBircan\BatterySurfBench\Registry;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureBundle;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureCar;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureConsoleLogger;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureCycleA;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureEngine;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureGarage;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureListing;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureLoggerConsumer;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureNamed;
use RuntimeException;

/**
 * Behavioral tests for the instantiator's public contract: building any
 * class by reflecting its constructor and resolving each parameter from a
 * recipe plus autowiring, sibling collaborators built from plain literal
 * {@see Registry}/{@see Definitions} instances rather than mocks.
 */
final class InstantiatorTest extends TestCase {

	/**
	 * Builds an instantiator wired to the given recipes and config, with an
	 * always-fresh instance store so tests never share cached singletons.
	 *
	 * @param array<string, array<string, mixed>> $recipes Recipe map, keyed by class name.
	 * @param array<string, mixed>                $config  Registry config, keyed by dot-notated id.
	 * @param array<string, mixed>                $runtime Runtime-only seeded literals.
	 * @return Instantiator The wired instantiator.
	 */
	private function instantiator( array $recipes = array(), array $config = array(), array $runtime = array() ): Instantiator {
		return new Instantiator(
			new Registry( $config ),
			new Definitions( $recipes ),
			new InstanceStore(),
			$runtime
		);
	}

	/**
	 * A class with no constructor builds without any recipe at all.
	 */
	public function test_make_builds_a_class_with_no_constructor(): void {
		$instance = $this->instantiator()->make( FixtureEngine::class );

		$this->assertInstanceOf( FixtureEngine::class, $instance );
	}

	/**
	 * A concrete constructor dependency is autowired and recursively built,
	 * with no recipe required for either class.
	 */
	public function test_make_autowires_a_concrete_dependency_recursively(): void {
		$car = $this->instantiator()->make( FixtureCar::class );

		$this->assertInstanceOf( FixtureCar::class, $car );
		$this->assertInstanceOf( FixtureEngine::class, $car->engine() );
	}

	/**
	 * A deep A -> B -> C autowired graph builds fully from a single `make()`.
	 */
	public function test_make_builds_a_deep_dependency_graph(): void {
		$garage = $this->instantiator()->make( FixtureGarage::class );

		$this->assertInstanceOf( FixtureGarage::class, $garage );
		$this->assertInstanceOf( FixtureCar::class, $garage->car() );
		$this->assertInstanceOf( FixtureEngine::class, $garage->car()->engine() );
	}

	/**
	 * A `%token%` arg spec resolves the scalar from the registry.
	 */
	public function test_make_resolves_a_token_scalar_from_the_registry(): void {
		$instantiator = $this->instantiator(
			array( FixtureNamed::class => array( 'args' => array( 'name' => '%surfer.name%' ) ) ),
			array( 'surfer' => array( 'name' => 'kai' ) )
		);

		$named = $instantiator->make( FixtureNamed::class );

		$this->assertSame( 'kai', $named->name() );
	}

	/**
	 * A plain string arg spec (neither a `%token%` nor a class name) is
	 * handed to the constructor as a literal.
	 */
	public function test_make_resolves_a_plain_literal_string(): void {
		$instantiator = $this->instantiator(
			array( FixtureNamed::class => array( 'args' => array( 'name' => 'literal-value' ) ) )
		);

		$named = $instantiator->make( FixtureNamed::class );

		$this->assertSame( 'literal-value', $named->name() );
	}

	/**
	 * An interface-typed parameter resolves through a `Class::class` recipe
	 * mapping to its concrete implementation.
	 */
	public function test_make_resolves_an_interface_through_a_class_mapping(): void {
		$instantiator = $this->instantiator(
			array( FixtureLoggerConsumer::class => array( 'args' => array( 'logger' => FixtureConsoleLogger::class ) ) )
		);

		$consumer = $instantiator->make( FixtureLoggerConsumer::class );

		$this->assertInstanceOf( FixtureConsoleLogger::class, $consumer->logger() );
	}

	/**
	 * Two `make()` calls for the same class, with no `shared` recipe key,
	 * return the identical cached instance (default-shared).
	 */
	public function test_make_defaults_to_returning_the_same_shared_instance(): void {
		$instantiator = $this->instantiator();

		$first  = $instantiator->make( FixtureEngine::class );
		$second = $instantiator->make( FixtureEngine::class );

		$this->assertSame( $first, $second );
	}

	/**
	 * `'shared' => false` opts a class out of the singleton cache, so two
	 * `make()` calls return distinct instances.
	 */
	public function test_make_builds_a_new_instance_each_time_when_not_shared(): void {
		$instantiator = $this->instantiator(
			array( FixtureEngine::class => array( 'shared' => false ) )
		);

		$first  = $instantiator->make( FixtureEngine::class );
		$second = $instantiator->make( FixtureEngine::class );

		$this->assertNotSame( $first, $second );
	}

	/**
	 * A `csv` arg spec splits the resolved token string into an array.
	 */
	public function test_make_resolves_a_csv_spec_into_an_array(): void {
		$instantiator = $this->instantiator(
			array( FixtureListing::class => array( 'args' => array( 'items' => array( 'csv' => '%surf.pages%' ) ) ) ),
			array( 'surf' => array( 'pages' => 'article-1,gallery,article-2' ) )
		);

		$listing = $instantiator->make( FixtureListing::class );

		$this->assertSame( array( 'article-1', 'gallery', 'article-2' ), $listing->items() );
	}

	/**
	 * A `path` arg spec routes the resolved relative path through
	 * `Paths::path()`, never touching the real filesystem.
	 */
	public function test_make_resolves_a_path_spec_through_paths(): void {
		Functions\when( 'plugin_dir_path' )->justReturn( '/var/www/plugins/battery-surf-bench/' );

		$instantiator = $this->instantiator(
			array(
				Paths::class        => array( 'args' => array( 'plugin_file' => array( 'runtime' => 'plugin_file' ) ) ),
				FixtureNamed::class => array( 'args' => array( 'name' => array( 'path' => 'includes/Course/content' ) ) ),
			),
			array(),
			array( 'plugin_file' => '/var/www/plugins/battery-surf-bench/battery-surf-bench.php' )
		);

		$named = $instantiator->make( FixtureNamed::class );

		$this->assertSame( '/var/www/plugins/battery-surf-bench/includes/Course/content', $named->name() );
	}

	/**
	 * A `services` arg spec resolves to an array of built instances.
	 */
	public function test_make_resolves_a_services_spec_into_built_instances(): void {
		$instantiator = $this->instantiator(
			array(
				FixtureBundle::class => array(
					'args' => array(
						'components' => array( 'services' => array( FixtureEngine::class, FixtureConsoleLogger::class ) ),
					),
				),
			)
		);

		$bundle     = $instantiator->make( FixtureBundle::class );
		$components = $bundle->components();

		$this->assertCount( 2, $components );
		$this->assertInstanceOf( FixtureEngine::class, $components[0] );
		$this->assertInstanceOf( FixtureConsoleLogger::class, $components[1] );
	}

	/**
	 * A `runtime` arg spec returns the value seeded at construction, never
	 * from config.
	 */
	public function test_make_resolves_a_runtime_spec(): void {
		$instantiator = $this->instantiator(
			array( FixtureNamed::class => array( 'args' => array( 'name' => array( 'runtime' => 'plugin_file' ) ) ) ),
			array(),
			array( 'plugin_file' => '/path/to/plugin.php' )
		);

		$named = $instantiator->make( FixtureNamed::class );

		$this->assertSame( '/path/to/plugin.php', $named->name() );
	}

	/**
	 * A dependency cycle is detected and reported instead of recursing
	 * forever.
	 */
	public function test_make_throws_on_a_dependency_cycle(): void {
		$this->expectException( RuntimeException::class );
		$this->instantiator()->make( FixtureCycleA::class );
	}

	/**
	 * An interface-typed parameter with no recipe mapping cannot be
	 * autowired and is reported as unresolvable.
	 */
	public function test_make_throws_for_an_unmapped_interface_parameter(): void {
		$this->expectException( RuntimeException::class );
		$this->instantiator()->make( FixtureLoggerConsumer::class );
	}

	/**
	 * A required scalar parameter with no matching arg and no default is
	 * reported as unresolvable.
	 */
	public function test_make_throws_for_an_unresolvable_scalar_parameter(): void {
		$this->expectException( RuntimeException::class );
		$this->instantiator()->make( FixtureNamed::class );
	}
}
