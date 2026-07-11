<?php
/**
 * Instantiator test fixture: an interface with a concrete implementation.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Paired with {@see FixtureConsoleLogger}, used to prove a `Class::class`
 * recipe mapping resolves an interface-typed constructor parameter to its
 * concrete implementation.
 */
interface FixtureLoggerInterface {

	/**
	 * Identifies which implementation was resolved.
	 *
	 * @return string The implementation's identifier.
	 */
	public function id(): string;
}
