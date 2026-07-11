<?php
/**
 * Instantiator test fixture: a concrete implementation of an interface.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * The one production-style implementation of {@see FixtureLoggerInterface}
 * a recipe maps an interface-typed constructor parameter to.
 */
final class FixtureConsoleLogger implements FixtureLoggerInterface {

	/**
	 * Identifies this implementation.
	 *
	 * @return string The implementation's identifier.
	 */
	public function id(): string {
		return 'console';
	}
}
