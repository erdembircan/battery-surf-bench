<?php
/**
 * Test double for the capability abstraction.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Support;

use ErdemBircan\BatterySurfBench\Support\CapabilityInterface;

/**
 * A test double standing in for {@see \ErdemBircan\BatterySurfBench\Support\Capability}:
 * returns a fixed, controllable answer from both methods, so a consumer's
 * tests can exercise its capability-gated behavior directly — without
 * mocking the WordPress `current_user_can()` global.
 */
final class FakeCapability implements CapabilityInterface {

	/**
	 * Stores the fixed answers this double returns.
	 *
	 * @param bool   $allows Whether {@see allows()} reports the current user authorized.
	 * @param string $slug   The capability string {@see slug()} returns.
	 */
	public function __construct(
		private bool $allows = true,
		private string $slug = 'manage_options'
	) {
	}

	/**
	 * Returns the fixed answer this double was built with.
	 *
	 * @return bool Whether the current user is authorized.
	 */
	public function allows(): bool {
		return $this->allows;
	}

	/**
	 * Returns the fixed capability string this double was built with.
	 *
	 * @return string The capability.
	 */
	public function slug(): string {
		return $this->slug;
	}
}
