<?php
/**
 * Instantiator test fixture: one half of a cyclic dependency pair.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Depends on {@see FixtureCycleB}, which in turn depends back on this class,
 * so autowiring both without a recipe must detect the cycle and fail loudly
 * rather than recurse forever.
 */
final class FixtureCycleA {

	/**
	 * Stores the injected collaborator.
	 *
	 * @param FixtureCycleB $b The injected dependency.
	 */
	public function __construct( private FixtureCycleB $b ) {
	}
}
