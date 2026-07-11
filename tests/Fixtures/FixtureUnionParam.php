<?php
/**
 * ContainerValidator test fixture: a class with a union-typed constructor parameter.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Takes a union-typed parameter, which neither the instantiator nor the
 * validator support autowiring — used to prove the validator reports a
 * union-typed autowired parameter as an error instead of skipping it.
 */
final class FixtureUnionParam {

	/**
	 * Stores the injected value.
	 *
	 * @param int|string $value The injected value.
	 */
	public function __construct( private int|string $value ) {
	}

	/**
	 * Exposes the injected value so a test can assert on it.
	 *
	 * @return int|string The injected value.
	 */
	public function value(): int|string {
		return $this->value;
	}
}
