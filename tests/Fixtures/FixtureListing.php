<?php
/**
 * Instantiator test fixture: a class taking an array constructor argument.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Fixtures;

/**
 * Takes a plain array, used to prove a `%token%` arg spec resolving to a
 * list-array config value is injected as that array directly.
 */
final class FixtureListing {

	/**
	 * Stores the injected items.
	 *
	 * @param array<int, string> $items The injected values.
	 */
	public function __construct( private array $items ) {
	}

	/**
	 * Exposes the injected values so a test can assert on them.
	 *
	 * @return array<int, string> The injected values.
	 */
	public function items(): array {
		return $this->items;
	}
}
