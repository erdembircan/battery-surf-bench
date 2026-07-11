<?php
/**
 * Instantiator test fixture: a class taking an array of built services.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Takes a plain array, used to prove a `services` spec resolves to an array
 * of built instances.
 */
final class FixtureBundle {

	/**
	 * Stores the injected components.
	 *
	 * @param array<int, object> $components The injected instances.
	 */
	public function __construct( private array $components ) {
	}

	/**
	 * Exposes the injected instances so a test can assert on them.
	 *
	 * @return array<int, object> The injected instances.
	 */
	public function components(): array {
		return $this->components;
	}
}
