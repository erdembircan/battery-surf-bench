<?php
/**
 * Instantiator test fixture: a class taking a scalar arg plus an autowired dependency.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Takes one recipe-supplied scalar and one autowired concrete dependency, so
 * building it exercises both plan instruction kinds (`value` and `make`) in
 * a single constructor — used to assert the exact shape `plan_for()`
 * produces and that a precompiled plan wires a class identically to the
 * live reflect path.
 */
final class FixtureVehicle {

	/**
	 * Stores the injected label and engine.
	 *
	 * @param string        $label  The injected label.
	 * @param FixtureEngine $engine The injected dependency.
	 */
	public function __construct( private string $label, private FixtureEngine $engine ) {
	}

	/**
	 * Exposes the injected label so a test can assert on it.
	 *
	 * @return string The injected label.
	 */
	public function label(): string {
		return $this->label;
	}

	/**
	 * Exposes the injected dependency so a test can assert on it.
	 *
	 * @return FixtureEngine The injected dependency.
	 */
	public function engine(): FixtureEngine {
		return $this->engine;
	}
}
