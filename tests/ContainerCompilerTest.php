<?php
/**
 * Tests for the build-time container-definition token flattener.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use ErdemBircan\BatterySurfBench\ContainerCompiler;
use ErdemBircan\BatterySurfBench\Registry;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureConsoleLogger;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureEngine;

/**
 * Behavioral tests for the compiler's public contract: `compile()` as a
 * pure function over plain literal recipe arrays and an in-memory
 * {@see Registry} — no filesystem involved, since writing the compiled
 * output to disk is `bin/CompileContainer.php`'s job, not this class's.
 */
final class ContainerCompilerTest extends TestCase {

	/**
	 * A top-level `%token%` arg resolves to its literal registry value.
	 */
	public function test_compile_resolves_a_top_level_token(): void {
		$registry = new Registry( array( 'namespace' => 'battery-surf-bench' ) );
		$services = array(
			FixtureEngine::class => array( 'args' => array( 'prefix' => '%namespace%' ) ),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame( 'battery-surf-bench', $baked[ FixtureEngine::class ]['args']['prefix'] );
	}

	/**
	 * A token nested inside a `csv` wrapper is baked to its literal string,
	 * with the wrapper key preserved.
	 */
	public function test_compile_resolves_a_token_nested_in_a_csv_wrapper(): void {
		$registry = new Registry( array( 'settings' => array( 'post_types' => 'page,post' ) ) );
		$services = array(
			FixtureEngine::class => array(
				'args' => array( 'selectable_post_types' => array( 'csv' => '%settings.post_types%' ) ),
			),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame(
			array( 'csv' => 'page,post' ),
			$baked[ FixtureEngine::class ]['args']['selectable_post_types']
		);
	}

	/**
	 * A token nested inside a `path` wrapper is baked, with the wrapper key
	 * preserved.
	 */
	public function test_compile_resolves_a_token_nested_in_a_path_wrapper(): void {
		$registry = new Registry( array( 'cockpit' => array( 'block_dir' => 'build/cockpit' ) ) );
		$services = array(
			FixtureEngine::class => array(
				'args' => array( 'block_dir' => array( 'path' => '%cockpit.block_dir%' ) ),
			),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame(
			array( 'path' => 'build/cockpit' ),
			$baked[ FixtureEngine::class ]['args']['block_dir']
		);
	}

	/**
	 * A `runtime` spec has no `%token%` inside it, so it is returned
	 * unchanged — it is resolved by the instantiator at boot, never baked.
	 */
	public function test_compile_leaves_a_runtime_spec_unchanged(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureEngine::class => array(
				'args' => array( 'plugin_file' => array( 'runtime' => 'plugin_file' ) ),
			),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame(
			array( 'runtime' => 'plugin_file' ),
			$baked[ FixtureEngine::class ]['args']['plugin_file']
		);
	}

	/**
	 * A `services` spec's class-FQCN entries are not `%token%` strings, so
	 * they are returned unchanged.
	 */
	public function test_compile_leaves_a_services_spec_unchanged(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureEngine::class => array(
				'args' => array( 'providers' => array( 'services' => array( FixtureConsoleLogger::class ) ) ),
			),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame(
			array( 'services' => array( FixtureConsoleLogger::class ) ),
			$baked[ FixtureEngine::class ]['args']['providers']
		);
	}

	/**
	 * A plain `Class::class` FQCN reference is not a `%token%`, so it is
	 * returned unchanged.
	 */
	public function test_compile_leaves_a_class_reference_unchanged(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureEngine::class => array( 'args' => array( 'logger' => FixtureConsoleLogger::class ) ),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame( FixtureConsoleLogger::class, $baked[ FixtureEngine::class ]['args']['logger'] );
	}

	/**
	 * A plain literal string and a scalar such as an int are left unchanged.
	 */
	public function test_compile_leaves_plain_literals_unchanged(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureEngine::class => array(
				'args'   => array(
					'label'   => 'literal-value',
					'retries' => 3,
				),
				'shared' => false,
			),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame( 'literal-value', $baked[ FixtureEngine::class ]['args']['label'] );
		$this->assertSame( 3, $baked[ FixtureEngine::class ]['args']['retries'] );
		$this->assertFalse( $baked[ FixtureEngine::class ]['shared'] );
	}

	/**
	 * A token several levels deep in nested arrays still bakes.
	 */
	public function test_compile_resolves_a_deeply_nested_token(): void {
		$registry = new Registry( array( 'surfer' => array( 'name' => 'kai' ) ) );
		$services = array(
			FixtureEngine::class => array(
				'args' => array(
					'nested' => array(
						'deeper' => array(
							'deepest' => '%surfer.name%',
						),
					),
				),
			),
		);

		$baked = ( new ContainerCompiler() )->compile( $services, $registry );

		$this->assertSame(
			'kai',
			$baked[ FixtureEngine::class ]['args']['nested']['deeper']['deepest']
		);
	}
}
