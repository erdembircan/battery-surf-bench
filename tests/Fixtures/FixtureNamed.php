<?php
/**
 * Instantiator test fixture: a class taking a single scalar constructor argument.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Takes a required, unresolvable-by-type scalar, used to prove `%token%`
 * config resolution, plain literal resolution, and `runtime` spec
 * resolution — and, with an empty recipe, that a required scalar with no
 * matching arg is reported as unresolvable.
 */
final class FixtureNamed {

	/**
	 * Stores the injected name.
	 *
	 * @param string $name The injected value.
	 */
	public function __construct( private string $name ) {
	}

	/**
	 * Exposes the injected value so a test can assert on it.
	 *
	 * @return string The injected value.
	 */
	public function name(): string {
		return $this->name;
	}
}
