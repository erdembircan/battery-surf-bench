<?php
/**
 * Build-time container-definition validator.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ReflectionClass;
use ReflectionIntersectionType;
use ReflectionNamedType;
use ReflectionParameter;
use ReflectionUnionType;

use function array_key_exists;
use function array_keys;
use function array_map;
use function array_merge;
use function array_shift;
use function class_exists;
use function in_array;
use function interface_exists;
use function is_a;
use function is_array;
use function is_bool;
use function is_float;
use function is_int;
use function is_object;
use function is_string;
use function sprintf;
use function str_ends_with;
use function str_starts_with;
use function trait_exists;
use function trim;

defined( 'ABSPATH' ) || exit;

/**
 * Reflects every class in the plugin's dependency closure and checks its
 * `Services.php` recipe against the real constructor, catching structural
 * errors — a typo'd argument key, an unknown config token, a type mismatch,
 * an interface with no concrete mapping — at build time instead of at
 * runtime.
 *
 * This is a linter, not a builder: {@see validate()} makes one full pass,
 * collects every error it finds rather than stopping at the first one, and
 * never throws for a validation problem — it reports. It shares no code
 * with {@see ContainerCompiler} on purpose: validating a recipe against a
 * constructor and transforming a recipe into a plan are distinct
 * responsibilities. It performs no file I/O and builds no objects — it only
 * reflects and reports. `bin/BuildContainer.php` is the one place that
 * decides what to do with the result: gate the build on an empty list.
 *
 * The runtime {@see Instantiator} keeps its own throws exactly as they are;
 * this class is an additional, earlier gate, not a replacement for that
 * defense in depth on the live/uncompiled path.
 */
class ContainerValidator {

	/**
	 * Validates every class reachable from the given service recipes — the
	 * recipes' own classes plus their whole dependency closure (autowired
	 * concrete dependencies, and every class a `make`, `services` or `path`
	 * instruction-producing spec references) — against their real
	 * constructors.
	 *
	 * @param array<string, array<string, mixed>> $services     The service-recipe map to validate.
	 * @param Registry                            $registry     Source of the config values `%token%` specs are checked against.
	 * @param array<int, string>                  $runtime_keys Runtime keys a `runtime` spec is allowed to reference.
	 * @return array<int, string> Human-readable error messages; empty when the recipes are valid.
	 */
	public function validate( array $services, Registry $registry, array $runtime_keys = array( 'plugin_file' ) ): array {
		$errors   = array();
		$visited  = array();
		$worklist = array_keys( $services );

		while ( ! empty( $worklist ) ) {
			$class_name = array_shift( $worklist );

			if ( array_key_exists( $class_name, $visited ) ) {
				continue;
			}

			$visited[ $class_name ] = true;

			$referenced = array();
			$errors     = array_merge(
				$errors,
				$this->validate_class( $class_name, $services[ $class_name ] ?? array(), $registry, $runtime_keys, $referenced )
			);

			foreach ( $referenced as $ref ) {
				if ( ! array_key_exists( $ref, $visited ) ) {
					$worklist[] = $ref;
				}
			}
		}

		return $errors;
	}

	/**
	 * Validates a single class's recipe against its real constructor,
	 * collecting every problem found rather than stopping at the first.
	 *
	 * @param string               $class_name   Fully-qualified class name to validate.
	 * @param array<string, mixed> $recipe       The class's recipe (empty when reached only by autowiring).
	 * @param Registry             $registry     Source of the config values `%token%` specs are checked against.
	 * @param array<int, string>   $runtime_keys Runtime keys a `runtime` spec is allowed to reference.
	 * @param array<int, string>   $referenced   Out-parameter: classes referenced by this class's recipe, appended by reference for the closure walk.
	 * @return array<int, string> Human-readable error messages for this class.
	 */
	private function validate_class( string $class_name, array $recipe, Registry $registry, array $runtime_keys, array &$referenced ): array {
		// class_exists() alone reports false for an interface, but a
		// parameter can legitimately be typed to one (that is exactly what
		// the instantiability check right below exists to catch), so a
		// symbol that exists as an interface must still reach that check
		// rather than being reported as missing entirely.
		if ( ! $this->symbol_exists( $class_name ) ) {
			return array( sprintf( '%s: class does not exist', $class_name ) );
		}

		$ref = new ReflectionClass( $class_name );

		if ( ! $ref->isInstantiable() ) {
			return array(
				sprintf(
					'%s: is not instantiable (interface or abstract) — a parameter typed to it must map to a concrete class via its args',
					$class_name
				),
			);
		}

		$ctor = $ref->getConstructor();
		$args = $recipe['args'] ?? array();

		if ( null === $ctor ) {
			return $this->validate_unknown_arg_keys( $class_name, $args, array() );
		}

		$params = $ctor->getParameters();
		$names  = array_map( static fn ( ReflectionParameter $param ): string => $param->getName(), $params );

		$errors = $this->validate_unknown_arg_keys( $class_name, $args, $names );

		foreach ( $params as $param ) {
			$name = $param->getName();

			if ( array_key_exists( $name, $args ) ) {
				$errors = array_merge(
					$errors,
					$this->validate_arg( $class_name, $name, $args[ $name ], $param->getType(), $registry, $runtime_keys, $referenced )
				);
				continue;
			}

			$errors = array_merge( $errors, $this->validate_autowired_param( $class_name, $param, $referenced ) );
		}

		return $errors;
	}

	/**
	 * Finds every recipe argument key that does not match a real
	 * constructor parameter name — the typo-detection check.
	 *
	 * @param string               $class_name  Fully-qualified class name the recipe belongs to, for error messages.
	 * @param array<string, mixed> $args        The recipe's `args` map.
	 * @param array<int, string>   $param_names The constructor's real parameter names.
	 * @return array<int, string> Human-readable error messages, one per unknown key.
	 */
	private function validate_unknown_arg_keys( string $class_name, array $args, array $param_names ): array {
		$errors = array();

		foreach ( array_keys( $args ) as $key ) {
			if ( ! in_array( $key, $param_names, true ) ) {
				$errors[] = sprintf( '%s: unknown argument "%s" — no matching constructor parameter', $class_name, $key );
			}
		}

		return $errors;
	}

	/**
	 * Validates a parameter that has no recipe-supplied arg spec, checking
	 * whether it can be autowired by type, and enqueuing a concrete
	 * dependency type into the closure when it can.
	 *
	 * @param string              $class_name Fully-qualified class name the parameter belongs to, for error messages.
	 * @param ReflectionParameter $param      The parameter to validate.
	 * @param array<int, string>  $referenced Out-parameter: classes referenced by this parameter, appended by reference for the closure walk.
	 * @return array<int, string> Human-readable error messages; empty when the parameter autowires cleanly.
	 */
	private function validate_autowired_param( string $class_name, ReflectionParameter $param, array &$referenced ): array {
		$name = $param->getName();
		$type = $param->getType();

		if ( $type instanceof ReflectionUnionType || $type instanceof ReflectionIntersectionType ) {
			return array( sprintf( '%s::%s: union/intersection types are not supported for autowiring', $class_name, $name ) );
		}

		if ( $type instanceof ReflectionNamedType && ! $type->isBuiltin() ) {
			$referenced[] = $type->getName();
			return array();
		}

		if ( $param->isDefaultValueAvailable() ) {
			return array();
		}

		if ( $type instanceof ReflectionNamedType && $type->allowsNull() ) {
			return array();
		}

		return array(
			sprintf( '%s::%s: missing required argument (expects %s)', $class_name, $name, $this->type_label( $type ) ),
		);
	}

	/**
	 * Validates a single recipe arg spec against the constructor parameter
	 * it is supplied for, dispatching on the spec's shape.
	 *
	 * @param string                   $class_name   Fully-qualified class name the spec belongs to, for error messages.
	 * @param string                   $param_name   Name of the parameter the spec is supplied for, for error messages.
	 * @param mixed                    $spec         The argument spec from the recipe's `args` map.
	 * @param ReflectionNamedType|null $type      The parameter's declared type, or null when untyped.
	 * @param Registry                 $registry     Source of the config values `%token%` specs are checked against.
	 * @param array<int, string>       $runtime_keys Runtime keys a `runtime` spec is allowed to reference.
	 * @param array<int, string>       $referenced   Out-parameter: classes referenced by this spec, appended by reference for the closure walk.
	 * @return array<int, string> Human-readable error messages; empty when the spec is valid.
	 */
	private function validate_arg( string $class_name, string $param_name, mixed $spec, ?ReflectionNamedType $type, Registry $registry, array $runtime_keys, array &$referenced ): array {
		if ( is_array( $spec ) ) {
			if ( array_key_exists( 'runtime', $spec ) ) {
				return $this->validate_runtime_arg( $class_name, $param_name, $spec['runtime'], $type, $runtime_keys );
			}

			if ( array_key_exists( 'csv', $spec ) ) {
				return $this->validate_csv_arg( $class_name, $param_name, $spec['csv'], $type, $registry );
			}

			if ( array_key_exists( 'path', $spec ) ) {
				return $this->validate_path_arg( $class_name, $param_name, $spec['path'], $type, $registry );
			}

			if ( array_key_exists( 'services', $spec ) ) {
				return $this->validate_services_arg( $class_name, $param_name, $spec['services'], $type, $referenced );
			}

			return $this->type_compat( $type, 'array' ) ? array() : array( $this->mismatch_message( $class_name, $param_name, $type, 'array' ) );
		}

		if ( is_string( $spec ) ) {
			return $this->validate_string_arg( $class_name, $param_name, $spec, $type, $registry, $referenced );
		}

		$kind = $this->kind_of( $spec );

		return $this->type_compat( $type, $kind ) ? array() : array( $this->mismatch_message( $class_name, $param_name, $type, $kind ) );
	}

	/**
	 * Validates a `['runtime' => key]` spec: the key must be seedable, and
	 * the produced value — always a string — must fit the parameter's type.
	 *
	 * @param string                   $class_name   Fully-qualified class name the spec belongs to, for error messages.
	 * @param string                   $param_name   Name of the parameter the spec is supplied for, for error messages.
	 * @param mixed                    $key          The runtime key the spec references.
	 * @param ReflectionNamedType|null $type      The parameter's declared type, or null when untyped.
	 * @param array<int, string>       $runtime_keys Runtime keys a `runtime` spec is allowed to reference.
	 * @return array<int, string> Human-readable error messages; empty when the spec is valid.
	 */
	private function validate_runtime_arg( string $class_name, string $param_name, mixed $key, ?ReflectionNamedType $type, array $runtime_keys ): array {
		$errors = array();

		if ( ! in_array( $key, $runtime_keys, true ) ) {
			$errors[] = sprintf( '%s::%s: unknown runtime key "%s"', $class_name, $param_name, (string) $key );
		}

		if ( ! $this->type_compat( $type, 'string' ) ) {
			$errors[] = $this->mismatch_message( $class_name, $param_name, $type, 'string' );
		}

		return $errors;
	}

	/**
	 * Validates a `['csv' => inner]` spec: the inner token, when present,
	 * must resolve, and the produced value — always an array — must fit the
	 * parameter's type.
	 *
	 * @param string                   $class_name Fully-qualified class name the spec belongs to, for error messages.
	 * @param string                   $param_name Name of the parameter the spec is supplied for, for error messages.
	 * @param mixed                    $inner      The spec's inner value.
	 * @param ReflectionNamedType|null $type    The parameter's declared type, or null when untyped.
	 * @param Registry                 $registry   Source of the config values `%token%` specs are checked against.
	 * @return array<int, string> Human-readable error messages; empty when the spec is valid.
	 */
	private function validate_csv_arg( string $class_name, string $param_name, mixed $inner, ?ReflectionNamedType $type, Registry $registry ): array {
		$errors = $this->validate_token_if_present( $class_name, $param_name, $inner, $registry );

		if ( ! $this->type_compat( $type, 'array' ) ) {
			$errors[] = sprintf(
				'%s::%s: a csv spec produces an array but the parameter expects %s',
				$class_name,
				$param_name,
				$this->type_label( $type )
			);
		}

		return $errors;
	}

	/**
	 * Validates a `['path' => inner]` spec: the inner token, when present,
	 * must resolve, and the produced value — always a string — must fit the
	 * parameter's type.
	 *
	 * @param string                   $class_name Fully-qualified class name the spec belongs to, for error messages.
	 * @param string                   $param_name Name of the parameter the spec is supplied for, for error messages.
	 * @param mixed                    $inner      The spec's inner value.
	 * @param ReflectionNamedType|null $type    The parameter's declared type, or null when untyped.
	 * @param Registry                 $registry   Source of the config values `%token%` specs are checked against.
	 * @return array<int, string> Human-readable error messages; empty when the spec is valid.
	 */
	private function validate_path_arg( string $class_name, string $param_name, mixed $inner, ?ReflectionNamedType $type, Registry $registry ): array {
		$errors = $this->validate_token_if_present( $class_name, $param_name, $inner, $registry );

		if ( ! $this->type_compat( $type, 'string' ) ) {
			$errors[] = $this->mismatch_message( $class_name, $param_name, $type, 'string' );
		}

		return $errors;
	}

	/**
	 * Validates a `['services' => [classes]]` spec: the produced value —
	 * always an array — must fit the parameter's type, and every listed
	 * class must exist; each existing one is enqueued into the closure.
	 *
	 * @param string                   $class_name Fully-qualified class name the spec belongs to, for error messages.
	 * @param string                   $param_name Name of the parameter the spec is supplied for, for error messages.
	 * @param mixed                    $services   The spec's list of service class names.
	 * @param ReflectionNamedType|null $type    The parameter's declared type, or null when untyped.
	 * @param array<int, string>       $referenced Out-parameter: existing classes from the list, appended by reference for the closure walk.
	 * @return array<int, string> Human-readable error messages; empty when the spec is valid.
	 */
	private function validate_services_arg( string $class_name, string $param_name, mixed $services, ?ReflectionNamedType $type, array &$referenced ): array {
		$errors = array();

		if ( ! $this->type_compat( $type, 'array' ) ) {
			$errors[] = $this->mismatch_message( $class_name, $param_name, $type, 'array' );
		}

		foreach ( is_array( $services ) ? $services : array() as $service ) {
			if ( ! is_string( $service ) || ! class_exists( $service ) ) {
				$errors[] = sprintf( '%s::%s: services entry "%s" does not exist', $class_name, $param_name, (string) $service );
				continue;
			}

			$referenced[] = $service;
		}

		return $errors;
	}

	/**
	 * Validates a string-shaped arg spec: a `%token%` config lookup, a
	 * `Class::class` reference (a `make`), or a plain literal string.
	 *
	 * @param string                   $class_name Fully-qualified class name the spec belongs to, for error messages.
	 * @param string                   $param_name Name of the parameter the spec is supplied for, for error messages.
	 * @param string                   $spec       The string spec.
	 * @param ReflectionNamedType|null $type    The parameter's declared type, or null when untyped.
	 * @param Registry                 $registry   Source of the config values `%token%` specs are checked against.
	 * @param array<int, string>       $referenced Out-parameter: a referenced class, appended by reference for the closure walk.
	 * @return array<int, string> Human-readable error messages; empty when the spec is valid.
	 */
	private function validate_string_arg( string $class_name, string $param_name, string $spec, ?ReflectionNamedType $type, Registry $registry, array &$referenced ): array {
		if ( $this->is_token( $spec ) ) {
			$errors = $this->validate_token_if_present( $class_name, $param_name, $spec, $registry );

			if ( array() === $errors && ! $this->type_compat( $type, 'string' ) ) {
				$errors[] = $this->mismatch_message( $class_name, $param_name, $type, 'string' );
			}

			return $errors;
		}

		if ( class_exists( $spec ) ) {
			$referenced[] = $spec;

			if ( null === $type || 'mixed' === $this->type_label( $type ) ) {
				return array();
			}

			if ( ! $type->isBuiltin() ) {
				return is_a( $spec, $type->getName(), true )
					? array()
					: array( sprintf( '%s::%s: "%s" is not a %s', $class_name, $param_name, $spec, $type->getName() ) );
			}

			return array(
				sprintf( '%s::%s: expects %s but an object (%s) was given', $class_name, $param_name, $type->getName(), $spec ),
			);
		}

		if ( $type instanceof ReflectionNamedType && ! $type->isBuiltin() && 'mixed' !== $this->type_label( $type ) ) {
			return array(
				sprintf( '%s::%s: "%s" is neither a config token nor an existing class', $class_name, $param_name, $spec ),
			);
		}

		return $this->type_compat( $type, 'string' ) ? array() : array( $this->mismatch_message( $class_name, $param_name, $type, 'string' ) );
	}

	/**
	 * Validates that a `csv`/`path` spec's inner value, when it is a
	 * `%token%`, resolves against the registry.
	 *
	 * @param string   $class_name Fully-qualified class name the spec belongs to, for error messages.
	 * @param string   $param_name Name of the parameter the spec is supplied for, for error messages.
	 * @param mixed    $inner      The inner value to check.
	 * @param Registry $registry   Source of the config values `%token%` specs are checked against.
	 * @return array<int, string> Human-readable error messages; empty when the inner value is not an unresolvable token.
	 */
	private function validate_token_if_present( string $class_name, string $param_name, mixed $inner, Registry $registry ): array {
		if ( is_string( $inner ) && $this->is_token( $inner ) && ! $registry->has( trim( $inner, '%' ) ) ) {
			return array( sprintf( '%s::%s: unknown config token "%s"', $class_name, $param_name, $inner ) );
		}

		return array();
	}

	/**
	 * Tells whether a string is a `%token%` config-lookup spec.
	 *
	 * @param string $spec The string to check.
	 * @return bool Whether the string starts and ends with `%`.
	 */
	private function is_token( string $spec ): bool {
		return str_starts_with( $spec, '%' ) && str_ends_with( $spec, '%' );
	}

	/**
	 * Tells whether a symbol exists as a class, interface, or trait —
	 * `class_exists()` alone reports false for an interface, but a
	 * constructor parameter can legitimately be typed to one.
	 *
	 * @param string $symbol The fully-qualified symbol name to check.
	 * @return bool Whether the symbol is a known class, interface, or trait.
	 */
	private function symbol_exists( string $symbol ): bool {
		return class_exists( $symbol ) || interface_exists( $symbol ) || trait_exists( $symbol );
	}

	/**
	 * Classifies a plain literal value's kind for type-compatibility
	 * checking.
	 *
	 * @param mixed $value The value to classify.
	 * @return string One of `string`, `array`, `int`, `float`, `bool`, `object`, `null`, or `mixed` for anything else.
	 */
	private function kind_of( mixed $value ): string {
		return match ( true ) {
			is_string( $value ) => 'string',
			is_array( $value )  => 'array',
			is_int( $value )    => 'int',
			is_float( $value )  => 'float',
			is_bool( $value )   => 'bool',
			is_object( $value ) => 'object',
			null === $value     => 'null',
			default             => 'mixed',
		};
	}

	/**
	 * Tells whether a produced value's kind satisfies a parameter's
	 * declared type — conservative on purpose, so it never false-positives
	 * on a legitimate recipe.
	 *
	 * @param ReflectionNamedType|null $type The parameter's declared type, or null when untyped.
	 * @param string                   $kind The produced value's kind, from {@see kind_of()}.
	 * @return bool Whether the kind satisfies the type.
	 */
	private function type_compat( ?ReflectionNamedType $type, string $kind ): bool {
		if ( null === $type ) {
			return true;
		}

		$type_name = $this->type_label( $type );

		if ( 'mixed' === $type_name ) {
			return true;
		}

		if ( 'null' === $kind ) {
			return $type->allowsNull();
		}

		if ( ! $type->isBuiltin() ) {
			return false;
		}

		return match ( $type_name ) {
			'array', 'iterable' => 'array' === $kind,
			'string' => 'string' === $kind,
			'int' => 'int' === $kind,
			'float' => in_array( $kind, array( 'float', 'int' ), true ),
			'bool' => 'bool' === $kind,
			'object' => 'object' === $kind,
			default => true,
		};
	}

	/**
	 * Builds the generic "expects X but got Y" mismatch message.
	 *
	 * @param string                   $class_name Fully-qualified class name the mismatch belongs to.
	 * @param string                   $param_name Name of the mismatched parameter.
	 * @param ReflectionNamedType|null $type    The parameter's declared type, or null when untyped.
	 * @param string                   $kind       The produced value's kind that failed to satisfy the type.
	 * @return string The human-readable error message.
	 */
	private function mismatch_message( string $class_name, string $param_name, ?ReflectionNamedType $type, string $kind ): string {
		return sprintf(
			'%s::%s: expects %s but the configured value is %s',
			$class_name,
			$param_name,
			$this->type_label( $type ),
			$kind
		);
	}

	/**
	 * Renders a parameter type for an error message.
	 *
	 * @param ReflectionNamedType|null $type The type to label, or null when untyped.
	 * @return string The type's name, or `mixed` when untyped.
	 */
	private function type_label( ?ReflectionNamedType $type ): string {
		return null === $type ? 'mixed' : $type->getName();
	}
}
