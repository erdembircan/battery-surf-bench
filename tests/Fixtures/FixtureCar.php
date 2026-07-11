<?php
/**
 * Instantiator test fixture: a concrete class depending on another concrete class.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Depends on {@see FixtureEngine} through a concrete constructor type-hint,
 * so building it proves autowiring resolves and recurses into an
 * unrecipe'd concrete dependency.
 */
final class FixtureCar {

	/**
	 * Stores the injected engine.
	 *
	 * @param FixtureEngine $engine The injected dependency.
	 */
	public function __construct( private FixtureEngine $engine ) {
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
