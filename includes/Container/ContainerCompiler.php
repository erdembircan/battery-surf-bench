<?php
/**
 * Build-time container-definition plan compiler.
 *
 * @package ErdemBircan\BatterySurfBench\Container
 */

namespace ErdemBircan\BatterySurfBench\Container;

use ErdemBircan\BatterySurfBench\Core\Paths;

use function array_key_exists;
use function array_keys;
use function array_shift;
use function array_values;

defined( 'ABSPATH' ) || exit;

/**
 * Precomputes a reflection-free build PLAN for every class in the plugin's
 * dependency closure, so a build step can produce a compiled definitions
 * array {@see Instantiator::make()} can execute directly at runtime —
 * touching the Reflection API zero times, the same way a dumped Symfony
 * container works. Each plan's `%token%` config-lookup values are baked to
 * their literal {@see Registry} value along the way; everything else in a
 * recipe — class-FQCN strings, `runtime`/`services` operands, scalars — is
 * carried through the plan unchanged.
 *
 * Driving a fresh {@see Instantiator} (over a throwaway {@see InstanceStore},
 * since compiling never builds a real instance) to reflect each class via
 * {@see Instantiator::plan_for()}, this walks the transitive closure
 * starting from the given service recipes: every class a plan's `make` or
 * `services` instruction references — and, whenever a `path` instruction
 * appears, {@see Paths} itself, since that instruction calls
 * {@see Paths::path()} at runtime — is enqueued and planned in turn. This is
 * how classes reachable only by autowiring (bare Views with no recipe of
 * their own) still end up with a plan in the compiled output.
 *
 * This class performs no file I/O: it is a pure transform, exercised
 * directly by its own tests. Writing the compiled output to disk is
 * `bin/BuildContainer.php`'s job, not this class's.
 */
class ContainerCompiler {

	/**
	 * Compiles a build plan for every class reachable from the given service
	 * recipes — the recipes' own classes plus their whole dependency
	 * closure — baking every `%token%` recipe value against the registry
	 * along the way.
	 *
	 * @param array<string, array<string, mixed>> $services The service-recipe map to compile.
	 * @param Registry                            $registry Source of the config values `%token%` specs resolve against.
	 * @return array<string, array{plan: array<int, array{0: string, 1: mixed}>, shared: bool}> The compiled plan map, keyed by class name.
	 */
	public function compile( array $services, Registry $registry ): array {
		$instantiator = new Instantiator( $registry, new Definitions( $services ), new InstanceStore() );

		$compiled = array();
		$worklist = array_keys( $services );

		while ( ! empty( $worklist ) ) {
			$class_name = array_shift( $worklist );

			if ( array_key_exists( $class_name, $compiled ) ) {
				continue;
			}

			$plan = $instantiator->plan_for( $class_name );

			$compiled[ $class_name ] = array(
				'plan'   => $plan,
				'shared' => $services[ $class_name ]['shared'] ?? true,
			);

			foreach ( $this->referenced_classes( $plan ) as $referenced ) {
				if ( ! array_key_exists( $referenced, $compiled ) ) {
					$worklist[] = $referenced;
				}
			}
		}

		return $compiled;
	}

	/**
	 * Finds every class a plan's instructions reference — a `make`
	 * instruction's operand, each `services` instruction operand's
	 * elements, and {@see Paths} whenever a `path` instruction appears — so
	 * the compiler can enqueue it for planning in turn.
	 *
	 * @param array<int, array{0: string, 1: mixed}> $plan The plan to scan.
	 * @return array<int, string> The referenced class names.
	 */
	private function referenced_classes( array $plan ): array {
		$classes = array();

		foreach ( $plan as $instruction ) {
			list( $opcode, $operand ) = $instruction;

			if ( 'make' === $opcode ) {
				$classes[] = $operand;
			} elseif ( 'services' === $opcode ) {
				foreach ( array_values( $operand ) as $service ) {
					$classes[] = $service;
				}
			} elseif ( 'path' === $opcode ) {
				$classes[] = Paths::class;
			}
		}

		return $classes;
	}
}
