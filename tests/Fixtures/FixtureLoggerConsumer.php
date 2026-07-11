<?php
/**
 * Instantiator test fixture: a class depending on an interface.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Depends on {@see FixtureLoggerInterface} through an interface-typed
 * constructor parameter, which is not autowireable by type alone and so
 * requires a recipe's `Class::class` mapping to resolve.
 */
final class FixtureLoggerConsumer {

	/**
	 * Stores the injected logger.
	 *
	 * @param FixtureLoggerInterface $logger The injected dependency.
	 */
	public function __construct( private FixtureLoggerInterface $logger ) {
	}

	/**
	 * Exposes the injected dependency so a test can assert on it.
	 *
	 * @return FixtureLoggerInterface The injected dependency.
	 */
	public function logger(): FixtureLoggerInterface {
		return $this->logger;
	}
}
