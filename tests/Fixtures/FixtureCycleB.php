<?php
/**
 * Instantiator test fixture: the other half of a cyclic dependency pair.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Depends back on {@see FixtureCycleA}, closing the cycle started there.
 */
final class FixtureCycleB {

	/**
	 * Stores the injected collaborator.
	 *
	 * @param FixtureCycleA $a The injected dependency.
	 */
	public function __construct( private FixtureCycleA $a ) {
	}
}
