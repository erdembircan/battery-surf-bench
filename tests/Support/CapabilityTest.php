<?php
/**
 * Tests for the capability abstraction.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Support;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Support\Capability;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The capability wraps a single WordPress capability string behind one
 * injectable object. Its observable contract: {@see Capability::allows()}
 * reports whatever `current_user_can()` reports for the wrapped capability,
 * and {@see Capability::slug()} hands back the raw string unchanged for
 * WordPress registration APIs that require one.
 */
final class CapabilityTest extends TestCase {

	private const CAPABILITY = 'manage_options';

	/**
	 * Builds the capability under test.
	 *
	 * @return Capability The capability.
	 */
	private function capability(): Capability {
		return new Capability( self::CAPABILITY );
	}

	/**
	 * `allows()` checks the current user against the exact capability the
	 * instance was built with, and reports whatever `current_user_can()`
	 * reports for it.
	 */
	public function test_allows_checks_current_user_can_with_the_injected_capability(): void {
		Functions\expect( 'current_user_can' )
			->once()
			->with( self::CAPABILITY )
			->andReturn( true );

		$this->assertTrue( $this->capability()->allows() );
	}

	/**
	 * A user lacking the capability is reported as disallowed.
	 */
	public function test_allows_returns_false_when_current_user_can_denies(): void {
		Functions\expect( 'current_user_can' )
			->once()
			->with( self::CAPABILITY )
			->andReturn( false );

		$this->assertFalse( $this->capability()->allows() );
	}

	/**
	 * `slug()` hands back the raw capability string unchanged, for WordPress
	 * APIs (`add_menu_page()`, a post type's `capabilities` map, and so on)
	 * that require the string rather than a check.
	 */
	public function test_slug_returns_the_injected_capability_string(): void {
		$this->assertSame( self::CAPABILITY, $this->capability()->slug() );
	}
}
