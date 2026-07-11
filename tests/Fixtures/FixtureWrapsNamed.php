<?php
/**
 * ContainerValidator test fixture: a class autowiring a dependency that itself needs a recipe.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Depends on {@see FixtureNamed} purely through autowiring, with no recipe
 * of its own — used to prove the validator's closure walk reaches a
 * dependency that is never listed in the original service-recipe map and
 * still catches a problem with it (`FixtureNamed`'s required `name` argument
 * has no arg spec and no default when reached this way).
 */
final class FixtureWrapsNamed {

	/**
	 * Stores the injected dependency.
	 *
	 * @param FixtureNamed $named The injected dependency.
	 */
	public function __construct( private FixtureNamed $named ) {
	}

	/**
	 * Exposes the injected dependency so a test can assert on it.
	 *
	 * @return FixtureNamed The injected dependency.
	 */
	public function named(): FixtureNamed {
		return $this->named;
	}
}
