<?php
/**
 * Tests for the configuration registry.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests;

use ErdemBircan\BatterySurfBench\Registry;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use stdClass;

/**
 * Behavioral tests for the registry's public contract.
 */
final class RegistryTest extends TestCase {

	/**
	 * Consumers depend on the PSR-11 contract.
	 */
	public function test_implements_psr11_container_interface(): void {
		$this->assertInstanceOf( ContainerInterface::class, new Registry( array() ) );
	}

	/**
	 * A stored entry is returned verbatim.
	 */
	public function test_get_returns_stored_value(): void {
		$registry = new Registry( array( 'capability' => 'manage_options' ) );

		$this->assertSame( 'manage_options', $registry->get( 'capability' ) );
	}

	/**
	 * Any scalar value type round-trips, including a falsy `null`.
	 */
	public function test_get_returns_various_types(): void {
		$object   = new stdClass();
		$registry = new Registry(
			array(
				'string' => 'hello',
				'int'    => 42,
				'bool'   => false,
				'null'   => null,
				'object' => $object,
			)
		);

		$this->assertSame( 'hello', $registry->get( 'string' ) );
		$this->assertSame( 42, $registry->get( 'int' ) );
		$this->assertFalse( $registry->get( 'bool' ) );
		$this->assertNull( $registry->get( 'null' ) );
		$this->assertSame( $object, $registry->get( 'object' ) );
	}

	/**
	 * `has` reflects whether an entry was registered.
	 */
	public function test_has_reports_registration_state(): void {
		$registry = new Registry( array( 'present' => 'value' ) );

		$this->assertTrue( $registry->has( 'present' ) );
		$this->assertFalse( $registry->has( 'absent' ) );
	}

	/**
	 * A `null` entry is present, not missing.
	 */
	public function test_has_returns_true_for_null_value(): void {
		$registry = new Registry( array( 'nullable' => null ) );

		$this->assertTrue( $registry->has( 'nullable' ) );
	}

	/**
	 * Requesting an unknown id surfaces the PSR-11 not-found error.
	 */
	public function test_get_throws_not_found_exception_for_unknown_id(): void {
		$registry = new Registry( array() );

		$this->expectException( NotFoundExceptionInterface::class );
		$registry->get( 'nonexistent' );
	}

	/**
	 * Dot notation resolves nested scalar values, as the bootstrap relies on.
	 */
	public function test_get_resolves_dot_notation(): void {
		$registry = new Registry(
			array(
				'admin_menu' => array(
					'slug' => 'battery-surf-bench',
					'icon' => 'assets/images/menu-icon.svg',
				),
			)
		);

		$this->assertSame( 'battery-surf-bench', $registry->get( 'admin_menu.slug' ) );
		$this->assertSame( 'assets/images/menu-icon.svg', $registry->get( 'admin_menu.icon' ) );
	}

	/**
	 * `has` only reports true for leaf scalars reached via dot notation.
	 */
	public function test_has_reflects_dot_notated_leaves_only(): void {
		$registry = new Registry(
			array(
				'admin_menu' => array(
					'slug' => 'battery-surf-bench',
				),
			)
		);

		$this->assertTrue( $registry->has( 'admin_menu.slug' ) );
		$this->assertFalse( $registry->has( 'admin_menu' ) );
		$this->assertFalse( $registry->has( 'admin_menu.missing' ) );
	}

	/**
	 * An identifier that lands on a nested array is treated as not found,
	 * since consumers only ever read scalars.
	 */
	public function test_get_throws_for_array_value(): void {
		$registry = new Registry(
			array(
				'admin_menu' => array(
					'slug' => 'battery-surf-bench',
				),
			)
		);

		$this->expectException( NotFoundExceptionInterface::class );
		$registry->get( 'admin_menu' );
	}
}
