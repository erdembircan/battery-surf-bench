<?php
/**
 * Tests for the build-time container-definition validator.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Container;

use ErdemBircan\BatterySurfBench\Container\ContainerValidator;
use ErdemBircan\BatterySurfBench\Container\Registry;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureBundle;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureConsoleLogger;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureEngine;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureListing;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureLoggerConsumer;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureLoggerInterface;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureNamed;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureUnionParam;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureVehicle;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureWrapsNamed;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * Behavioral tests for the validator's public contract: `validate()` as a
 * linter over a small hand-built service-recipe map, fixture classes, and
 * an in-memory {@see Registry} — no filesystem involved, and no exceptions
 * for a validation problem, only collected messages.
 */
final class ContainerValidatorTest extends TestCase {

	/**
	 * A fully valid recipe map produces no errors at all.
	 */
	public function test_validate_returns_empty_for_a_fully_valid_map(): void {
		$registry = new Registry( array() );
		$services = array( FixtureVehicle::class => array( 'args' => array( 'label' => 'roadster' ) ) );

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertSame( array(), $errors );
	}

	/**
	 * A required scalar constructor parameter with no arg spec and no
	 * default is reported by class and parameter name.
	 */
	public function test_validate_reports_a_missing_required_scalar_arg(): void {
		$registry = new Registry( array() );
		$services = array( FixtureNamed::class => array() );

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( FixtureNamed::class . '::name', $errors[0] );
	}

	/**
	 * A recipe arg key that matches no real constructor parameter (a typo)
	 * is reported by the bad key, while the real parameter still resolves
	 * cleanly through its own, correctly-named key.
	 */
	public function test_validate_reports_an_unknown_arg_key(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureNamed::class => array(
				'args' => array(
					'nmae' => 'typo',
					'name' => 'roadster',
				),
			),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( 'unknown argument "nmae"', $errors[0] );
	}

	/**
	 * A `%token%` arg referencing a config key the registry does not have
	 * is reported by the token.
	 */
	public function test_validate_reports_an_unknown_config_token(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureNamed::class => array( 'args' => array( 'name' => '%does.not.exist%' ) ),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( 'unknown config token "%does.not.exist%"', $errors[0] );
	}

	/**
	 * A definition keyed by a class that does not exist is reported.
	 */
	public function test_validate_reports_a_nonexistent_class_as_a_definition_key(): void {
		$registry = new Registry( array() );
		$services = array( 'ErdemBircan\\BatterySurfBench\\Tests\\Fixtures\\DoesNotExist' => array() );

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( 'class does not exist', $errors[0] );
	}

	/**
	 * A `services` spec entry that does not exist as a class is reported.
	 */
	public function test_validate_reports_a_nonexistent_services_target(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureBundle::class => array(
				'args' => array( 'components' => array( 'services' => array( 'ErdemBircan\\Nope' ) ) ),
			),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( 'services entry "ErdemBircan\\Nope" does not exist', $errors[0] );
	}

	/**
	 * An interface reached as an autowired dependency, with no recipe
	 * mapping it to a concrete class, is reported as not instantiable.
	 */
	public function test_validate_reports_an_unmapped_interface_dependency(): void {
		$registry = new Registry( array() );
		$services = array( FixtureLoggerConsumer::class => array() );

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( FixtureLoggerInterface::class . ': is not instantiable', $errors[0] );
	}

	/**
	 * A union-typed constructor parameter with no recipe-supplied arg spec
	 * cannot be autowired and is reported.
	 */
	public function test_validate_reports_a_union_typed_autowired_param(): void {
		$registry = new Registry( array() );
		$services = array( FixtureUnionParam::class => array() );

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( 'union/intersection types are not supported', $errors[0] );
	}

	/**
	 * An object-typed parameter given a `%token%` scalar arg is a type
	 * mismatch.
	 */
	public function test_validate_reports_an_object_typed_param_given_a_token_scalar(): void {
		$registry = new Registry( array( 'logger' => array( 'kind' => 'console' ) ) );
		$services = array(
			FixtureLoggerConsumer::class => array( 'args' => array( 'logger' => '%logger.kind%' ) ),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( FixtureLoggerConsumer::class . '::logger', $errors[0] );
		$this->assertStringContainsString( 'expects', $errors[0] );
	}

	/**
	 * A `string` parameter given a `services` spec (which produces an
	 * array) is a type mismatch.
	 */
	public function test_validate_reports_a_string_param_given_a_services_spec(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureNamed::class => array(
				'args' => array( 'name' => array( 'services' => array( FixtureEngine::class ) ) ),
			),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( FixtureNamed::class . '::name', $errors[0] );
		$this->assertStringContainsString( 'expects string', $errors[0] );
	}

	/**
	 * A `%token%` that resolves to a list-array config value into an
	 * `array`-typed parameter is valid — the Registry returns list values
	 * whole, so this is the array-typed sibling of a scalar token.
	 */
	public function test_validate_accepts_a_token_array_into_an_array_param(): void {
		$registry = new Registry( array( 'surf' => array( 'pages' => array( 'a', 'b' ) ) ) );
		$services = array(
			FixtureListing::class => array( 'args' => array( 'items' => '%surf.pages%' ) ),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertSame( array(), $errors );
	}

	/**
	 * A `%token%` that resolves to a list-array config value into a
	 * `string`-typed parameter is a type mismatch — the validator resolves
	 * the token's actual kind rather than assuming every token is a string.
	 */
	public function test_validate_reports_a_token_array_given_to_a_string_param(): void {
		$registry = new Registry( array( 'surf' => array( 'pages' => array( 'a', 'b' ) ) ) );
		$services = array(
			FixtureNamed::class => array( 'args' => array( 'name' => '%surf.pages%' ) ),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( FixtureNamed::class . '::name', $errors[0] );
		$this->assertStringContainsString( 'expects string', $errors[0] );
	}

	/**
	 * A `%token%` that resolves to a scalar string config value into an
	 * `array`-typed parameter is a type mismatch.
	 */
	public function test_validate_reports_a_token_string_given_to_an_array_param(): void {
		$registry = new Registry( array( 'surfer' => array( 'name' => 'kai' ) ) );
		$services = array(
			FixtureListing::class => array( 'args' => array( 'items' => '%surfer.name%' ) ),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( FixtureListing::class . '::items', $errors[0] );
		$this->assertStringContainsString( 'expects array', $errors[0] );
	}

	/**
	 * A `make`-position class reference that does not satisfy the
	 * parameter's declared type is reported.
	 */
	public function test_validate_reports_a_make_target_not_matching_the_param_type(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureLoggerConsumer::class => array( 'args' => array( 'logger' => FixtureEngine::class ) ),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString(
			FixtureLoggerConsumer::class . '::logger: "' . FixtureEngine::class . '" is not a ' . FixtureLoggerInterface::class,
			$errors[0]
		);
	}

	/**
	 * A single pass over a map containing several distinct problems returns
	 * every one of them — the validator never stops at the first error.
	 */
	public function test_validate_collects_every_error_in_one_pass(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureNamed::class          => array( 'args' => array( 'nmae' => 'typo' ) ),
			FixtureListing::class        => array( 'args' => array( 'items' => '%missing.token%' ) ),
			'ErdemBircan\\Nope\\AtAll'   => array(),
			FixtureLoggerConsumer::class => array(),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		// Five distinct problems: the typo'd key AND the still-missing
		// required `name` arg on FixtureNamed (two), the unknown token on
		// FixtureListing, the nonexistent definition key, and the unmapped
		// interface dependency reached through FixtureLoggerConsumer's
		// closure — proving a single pass collects all of them rather than
		// stopping at the first.
		$this->assertCount( 5, $errors );

		$joined = implode( "\n", $errors );
		$this->assertStringContainsString( 'unknown argument "nmae"', $joined );
		$this->assertStringContainsString( 'missing required argument', $joined );
		$this->assertStringContainsString( 'unknown config token "%missing.token%"', $joined );
		$this->assertStringContainsString( 'ErdemBircan\\Nope\\AtAll: class does not exist', $joined );
		$this->assertStringContainsString( FixtureLoggerInterface::class . ': is not instantiable', $joined );
	}

	/**
	 * A broken dependency reached only through autowiring — never listed in
	 * the original recipe map — is still walked into the closure and
	 * caught.
	 */
	public function test_validate_walks_the_closure_to_catch_a_broken_autowired_dependency(): void {
		$registry = new Registry( array() );
		$services = array( FixtureWrapsNamed::class => array() );

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertCount( 1, $errors );
		$this->assertStringContainsString( FixtureNamed::class . '::name', $errors[0] );
		$this->assertStringContainsString( 'missing required argument', $errors[0] );
	}

	/**
	 * `FixtureConsoleLogger` — used only for its class-string existence in
	 * other tests' recipe maps — is a valid, instantiable target on its
	 * own, so a `services` spec referencing it produces no error.
	 */
	public function test_validate_accepts_a_valid_services_spec(): void {
		$registry = new Registry( array() );
		$services = array(
			FixtureBundle::class => array(
				'args' => array( 'components' => array( 'services' => array( FixtureConsoleLogger::class ) ) ),
			),
		);

		$errors = ( new ContainerValidator() )->validate( $services, $registry );

		$this->assertSame( array(), $errors );
	}
}
