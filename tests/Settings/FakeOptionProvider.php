<?php
/**
 * Test double for an option definition provider.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Settings;

use ErdemBircan\BatterySurfBench\Settings\OptionProvider;

/**
 * A test double standing in for a real domain's {@see OptionProvider} (e.g.
 * `CourseOrderOption`): returns a fixed definition and records whether it was
 * ever asked for one, so a test can prove the registry only builds a
 * definition when it actually registers it.
 */
final class FakeOptionProvider implements OptionProvider {

	/**
	 * Whether {@see self::definition()} has been called.
	 *
	 * @var bool
	 */
	public bool $was_asked = false;

	/**
	 * Stores the fixed definition this provider returns.
	 *
	 * @param array{name: string, args: array<string, mixed>} $definition The definition to return.
	 */
	public function __construct( private array $definition ) {
	}

	/**
	 * Returns the fixed definition, recording that it was asked for.
	 *
	 * @return array{name: string, args: array<string, mixed>} The fixed definition.
	 */
	public function definition(): array {
		$this->was_asked = true;

		return $this->definition;
	}
}
