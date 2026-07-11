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
 * Builds any class by reflecting its constructor and resolving each
 * parameter from the service-recipe map ({@see Definitions}) and the plugin
 * configuration ({@see Registry}), caching shared instances in an
 * {@see InstanceStore}. This is the only place in the plugin that performs
 * reflection; {@see Definitions} and {@see InstanceStore} are deliberately
 * kept as pure PSR-11 storage with no building logic of their own, and this
 * class is deliberately not itself a PSR-11 container.
 */
class Instantiator {

	/**
	 * Fully-qualified class names currently being built, used to detect a
	 * dependency cycle while resolving constructor parameters.
	 *
	 * @var array<string, true>
	 */
	private array $building = array();

	/**
	 * Stores the collaborators used to resolve and cache built instances.
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
	 * Builds (or returns the cached) instance of the given class, recursively
	 * resolving and building its constructor dependencies.
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
		$ref    = new ReflectionClass( $class_name );

		if ( ! $ref->isInstantiable() ) {
			throw new RuntimeException(
				esc_html( sprintf( 'Cannot instantiate "%s": it is not a concrete, instantiable class.', $class_name ) )
			);
		}

		if ( array_key_exists( $class_name, $this->building ) ) {
			throw new RuntimeException(
				esc_html( sprintf( 'Dependency cycle detected while building "%s".', $class_name ) )
			);
		}

		$this->building[ $class_name ] = true;

		try {
			$ctor = $ref->getConstructor();

			if ( null === $ctor ) {
				$object = new $class_name();
			} else {
				$object = $ref->newInstanceArgs( $this->resolve_args( $class_name, $ctor->getParameters(), $recipe ) );
			}
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
	 * Resolves a constructor's parameters, in declared order, to a positional
	 * argument list.
	 *
	 * @param string                $class_name Fully-qualified class name the parameters belong to, for error messages.
	 * @param ReflectionParameter[] $params     The constructor's parameters.
	 * @param array<string, mixed>  $recipe     The class's build recipe.
	 * @throws RuntimeException When a parameter cannot be resolved.
	 * @return array<int, mixed> The resolved, positional arguments.
	 */
	private function resolve_args( string $class_name, array $params, array $recipe ): array {
		$args     = $recipe['args'] ?? array();
		$resolved = array();

		foreach ( $params as $param ) {
			$resolved[] = $this->resolve_param( $class_name, $param, $args );
		}

		return $resolved;
	}

	/**
	 * Resolves a single constructor parameter, preferring a recipe-supplied
	 * arg spec and falling back to autowiring by type.
	 *
	 * @param string               $class_name Fully-qualified class name the parameter belongs to, for error messages.
	 * @param ReflectionParameter  $param      The parameter to resolve.
	 * @param array<string, mixed> $args       The recipe's `args` map, keyed by parameter name.
	 * @throws RuntimeException When the parameter cannot be resolved.
	 * @return mixed The resolved value.
	 */
	private function resolve_param( string $class_name, ReflectionParameter $param, array $args ): mixed {
		$name = $param->getName();

		if ( array_key_exists( $name, $args ) ) {
			return $this->resolve_arg( $args[ $name ] );
		}

		$type = $param->getType();

		if ( $type instanceof ReflectionUnionType || $type instanceof ReflectionIntersectionType ) {
			throw new RuntimeException(
				esc_html( sprintf( 'Cannot resolve parameter "%s" of "%s": union and intersection types are unsupported.', $name, $class_name ) )
			);
		}

		if ( $type instanceof ReflectionNamedType && ! $type->isBuiltin() ) {
			return $this->make( $type->getName() );
		}

		if ( $param->isDefaultValueAvailable() ) {
			return $param->getDefaultValue();
		}

		if ( $type instanceof ReflectionNamedType && $type->allowsNull() ) {
			return null;
		}

		throw new RuntimeException(
			esc_html( sprintf( 'Cannot resolve parameter "%s" of "%s".', $name, $class_name ) )
		);
	}

	/**
	 * Resolves a single argument spec from a recipe's `args` map to its
	 * runtime value.
	 *
	 * @param mixed $spec The argument spec.
	 * @throws RuntimeException When a `runtime` spec references an unseeded key.
	 * @return mixed The resolved value.
	 */
	private function resolve_arg( mixed $spec ): mixed {
		if ( is_array( $spec ) ) {
			return $this->resolve_array_spec( $spec );
		}

		if ( is_string( $spec ) ) {
			return $this->resolve_string_spec( $spec );
		}

		return $spec;
	}

	/**
	 * Resolves an array-shaped argument spec: `runtime`, `csv`, `path` or
	 * `services`, falling back to the array itself as a plain literal.
	 *
	 * @param array<string, mixed> $spec The array spec.
	 * @throws RuntimeException When a `runtime` spec references an unseeded key.
	 * @return mixed The resolved value.
	 */
	private function resolve_array_spec( array $spec ): mixed {
		if ( array_key_exists( 'runtime', $spec ) ) {
			$key = $spec['runtime'];

			if ( ! array_key_exists( $key, $this->runtime ) ) {
				throw new RuntimeException(
					esc_html( sprintf( 'No runtime value was seeded for "%s".', $key ) )
				);
			}

			return $this->runtime[ $key ];
		}

		if ( array_key_exists( 'csv', $spec ) ) {
			return explode( ',', (string) $this->resolve_arg( $spec['csv'] ) );
		}

		if ( array_key_exists( 'path', $spec ) ) {
			return $this->make( Paths::class )->path( (string) $this->resolve_arg( $spec['path'] ) );
		}

		if ( array_key_exists( 'services', $spec ) ) {
			return array_map( fn ( string $service ): object => $this->make( $service ), $spec['services'] );
		}

		return $spec;
	}

	/**
	 * Resolves a string-shaped argument spec: a `%token%` config lookup, a
	 * `Class::class` reference, or a plain literal string.
	 *
	 * @param string $spec The string spec.
	 * @return mixed The resolved value.
	 */
	private function resolve_string_spec( string $spec ): mixed {
		if ( str_starts_with( $spec, '%' ) && str_ends_with( $spec, '%' ) ) {
			return $this->registry->get( trim( $spec, '%' ) );
		}

		if ( class_exists( $spec ) ) {
			return $this->make( $spec );
		}

		return $spec;
	}
}
