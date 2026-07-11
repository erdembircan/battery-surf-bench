<?php
/**
 * Reflection-based service builder.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ReflectionClass;
use ReflectionIntersectionType;
use ReflectionNamedType;
use ReflectionParameter;
use ReflectionUnionType;
use RuntimeException;

use function array_key_exists;
use function array_map;
use function array_values;
use function class_exists;
use function esc_html;
use function explode;
use function is_array;
use function is_string;
use function sprintf;
use function str_ends_with;
use function str_starts_with;
use function trim;

defined( 'ABSPATH' ) || exit;

/**
 * Builds any class from a build PLAN — an ordered list of instructions, one
 * per constructor parameter — executed with zero Reflection API calls.
 * {@see plan_for()} is the only place in the plugin that performs
 * reflection: it inspects a class's constructor once and returns its plan,
 * consulting the service-recipe map ({@see Definitions}) and the plugin
 * configuration ({@see Registry}) to decide each instruction. {@see make()}
 * executes a recipe's precompiled `plan` when one is present — the shape
 * {@see ContainerCompiler} produces for the whole class-closure ahead of
 * time — and falls back to planning the class live otherwise, caching
 * shared instances in an {@see InstanceStore} either way. {@see Definitions}
 * and {@see InstanceStore} are deliberately kept as pure PSR-11 storage with
 * no building logic of their own, and this class is deliberately not itself
 * a PSR-11 container.
 */
class Instantiator {

	/**
	 * Fully-qualified class names currently being built, used to detect a
	 * dependency cycle while executing a plan.
	 *
	 * @var array<string, true>
	 */
	private array $building = array();

	/**
	 * Stores the collaborators used to plan, execute and cache built
	 * instances.
	 *
	 * @param Registry             $registry    Source of config-token values (`%token%` specs).
	 * @param Definitions          $definitions Source of each class's build recipe.
	 * @param InstanceStore        $instances   Cache of already-built shared instances.
	 * @param array<string, mixed> $runtime     Runtime-only literals seeded at construction (e.g. `plugin_file`), values that must never come from config.
	 */
	public function __construct(
		private Registry $registry,
		private Definitions $definitions,
		private InstanceStore $instances,
		private array $runtime = array()
	) {
	}

	/**
	 * Reflects a class's constructor once and returns its build plan: an
	 * ordered list of `[opcode, operand]` instructions, one per parameter,
	 * that {@see execute_plan()} can later run without touching the
	 * Reflection API again. {@see ContainerCompiler} calls this for every
	 * class in the plugin's dependency closure to produce the plan map a
	 * compiled build ships.
	 *
	 * @param string $class_name Fully-qualified class name to plan.
	 * @throws RuntimeException When the class cannot be instantiated, or a constructor parameter cannot be resolved.
	 * @return array<int, array{0: string, 1: mixed}> The class's build plan.
	 */
	public function plan_for( string $class_name ): array {
		$recipe = $this->definitions->has( $class_name ) ? $this->definitions->get( $class_name ) : array();
		$ref    = new ReflectionClass( $class_name );

		if ( ! $ref->isInstantiable() ) {
			throw new RuntimeException(
				esc_html( sprintf( 'Cannot instantiate "%s": it is not a concrete, instantiable class.', $class_name ) )
			);
		}

		$ctor = $ref->getConstructor();

		if ( null === $ctor ) {
			return array();
		}

		$args = $recipe['args'] ?? array();
		$plan = array();

		foreach ( $ctor->getParameters() as $param ) {
			$name = $param->getName();

			$plan[] = array_key_exists( $name, $args )
				? $this->plan_arg( $args[ $name ] )
				: $this->plan_param( $class_name, $param );
		}

		return $plan;
	}

	/**
	 * Builds (or returns the cached) instance of the given class, using its
	 * definitions recipe's precompiled `plan` when present and planning the
	 * class live otherwise — either way the object is wired identically.
	 *
	 * @param string $class_name Fully-qualified class name to build.
	 * @throws RuntimeException When the class cannot be instantiated, a dependency cycle is detected, or a constructor parameter cannot be resolved.
	 * @return object The built (or cached) instance.
	 */
	public function make( string $class_name ): object {
		if ( $this->instances->has( $class_name ) ) {
			return $this->instances->get( $class_name );
		}

		$recipe = $this->definitions->has( $class_name ) ? $this->definitions->get( $class_name ) : array();
		$plan   = $recipe['plan'] ?? $this->plan_for( $class_name );

		if ( array_key_exists( $class_name, $this->building ) ) {
			throw new RuntimeException(
				esc_html( sprintf( 'Dependency cycle detected while building "%s".', $class_name ) )
			);
		}

		$this->building[ $class_name ] = true;

		try {
			$object = $this->execute_plan( $class_name, $plan );
		} finally {
			unset( $this->building[ $class_name ] );
		}

		$shared = $recipe['shared'] ?? true;

		if ( $shared ) {
			$this->instances->set( $class_name, $object );
		}

		return $object;
	}

	/**
	 * Builds the plan instruction for a single constructor parameter that
	 * has no recipe-supplied arg spec, autowiring it by type.
	 *
	 * @param string              $class_name Fully-qualified class name the parameter belongs to, for error messages.
	 * @param ReflectionParameter $param      The parameter to plan.
	 * @throws RuntimeException When the parameter cannot be resolved.
	 * @return array{0: string, 1: mixed} The plan instruction.
	 */
	private function plan_param( string $class_name, ReflectionParameter $param ): array {
		$name = $param->getName();
		$type = $param->getType();

		if ( $type instanceof ReflectionUnionType || $type instanceof ReflectionIntersectionType ) {
			throw new RuntimeException(
				esc_html( sprintf( 'Cannot resolve parameter "%s" of "%s": union and intersection types are unsupported.', $name, $class_name ) )
			);
		}

		if ( $type instanceof ReflectionNamedType && ! $type->isBuiltin() ) {
			return array( 'make', $type->getName() );
		}

		if ( $param->isDefaultValueAvailable() ) {
			return array( 'value', $param->getDefaultValue() );
		}

		if ( $type instanceof ReflectionNamedType && $type->allowsNull() ) {
			return array( 'value', null );
		}

		throw new RuntimeException(
			esc_html( sprintf( 'Cannot resolve parameter "%s" of "%s".', $name, $class_name ) )
		);
	}

	/**
	 * Converts a single recipe arg spec into one plan instruction.
	 *
	 * @param mixed $spec The argument spec from a recipe's `args` map.
	 * @return array{0: string, 1: mixed} The plan instruction.
	 */
	private function plan_arg( mixed $spec ): array {
		if ( is_array( $spec ) ) {
			return $this->plan_array_arg( $spec );
		}

		if ( is_string( $spec ) ) {
			if ( str_starts_with( $spec, '%' ) && str_ends_with( $spec, '%' ) ) {
				return array( 'value', $this->registry->get( trim( $spec, '%' ) ) );
			}

			if ( class_exists( $spec ) ) {
				return array( 'make', $spec );
			}
		}

		return array( 'value', $spec );
	}

	/**
	 * Converts an array-shaped recipe arg spec — `runtime`, `csv`, `path` or
	 * `services` — into one plan instruction, falling back to a `value`
	 * instruction carrying the array itself as a plain literal.
	 *
	 * @param array<string, mixed> $spec The array spec.
	 * @return array{0: string, 1: mixed} The plan instruction.
	 */
	private function plan_array_arg( array $spec ): array {
		if ( array_key_exists( 'runtime', $spec ) ) {
			return array( 'runtime', $spec['runtime'] );
		}

		if ( array_key_exists( 'csv', $spec ) ) {
			return array( 'value', explode( ',', (string) $this->plan_token( $spec['csv'] ) ) );
		}

		if ( array_key_exists( 'path', $spec ) ) {
			return array( 'path', (string) $this->plan_token( $spec['path'] ) );
		}

		if ( array_key_exists( 'services', $spec ) ) {
			return array( 'services', array_values( $spec['services'] ) );
		}

		return array( 'value', $spec );
	}

	/**
	 * Resolves the inner token of a `csv`/`path` spec to a scalar so it can
	 * be baked into the plan instruction: a `%token%` string resolves
	 * against the registry, anything else is returned as-is.
	 *
	 * @param mixed $spec The inner spec to resolve.
	 * @return mixed The resolved scalar.
	 */
	private function plan_token( mixed $spec ): mixed {
		if ( is_string( $spec ) && str_starts_with( $spec, '%' ) && str_ends_with( $spec, '%' ) ) {
			return $this->registry->get( trim( $spec, '%' ) );
		}

		return $spec;
	}

	/**
	 * Executes a build plan — resolving each instruction's operand against
	 * the runtime's live state and constructing the class — without
	 * touching the Reflection API.
	 *
	 * @param string                                 $class_name Fully-qualified class name the plan builds.
	 * @param array<int, array{0: string, 1: mixed}> $plan The class's build plan.
	 * @throws RuntimeException When a `runtime` instruction references an unseeded key.
	 * @return object The built instance.
	 */
	private function execute_plan( string $class_name, array $plan ): object {
		$args = array();

		foreach ( $plan as $instruction ) {
			list( $opcode, $operand ) = $instruction;

			$args[] = match ( $opcode ) {
				'make'     => $this->make( $operand ),
				'services' => array_map( fn ( string $service ): object => $this->make( $service ), $operand ),
				'runtime'  => $this->runtime_value( $operand ),
				'path'     => $this->make( Paths::class )->path( $operand ),
				'value'    => $operand,
			};
		}

		return new $class_name( ...$args );
	}

	/**
	 * Resolves a `runtime` instruction's operand to its seeded value.
	 *
	 * @param string $key Runtime key to look up.
	 * @throws RuntimeException When no runtime value was seeded for the key.
	 * @return mixed The seeded value.
	 */
	private function runtime_value( string $key ): mixed {
		if ( ! array_key_exists( $key, $this->runtime ) ) {
			throw new RuntimeException(
				esc_html( sprintf( 'No runtime value was seeded for "%s".', $key ) )
			);
		}

		return $this->runtime[ $key ];
	}
}
