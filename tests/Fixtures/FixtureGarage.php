<?php
/**
 * Instantiator test fixture: a three-level autowired dependency graph.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Depends on {@see FixtureCar}, which itself depends on {@see FixtureEngine},
 * so building it proves a deep A -> B -> C autowired graph builds fully.
 */
final class FixtureGarage {

	/**
	 * Stores the injected car.
	 *
	 * @param FixtureCar $car The injected dependency.
	 */
	public function __construct( private FixtureCar $car ) {
	}

	/**
	 * Exposes the injected dependency so a test can assert on it.
	 *
	 * @return FixtureCar The injected dependency.
	 */
	public function car(): FixtureCar {
		return $this->car;
	}
}
