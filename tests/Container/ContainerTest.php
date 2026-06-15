<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Tests for the PSR-11 container.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Container;

use ErdemBircan\BatterySurfBench\Container\Container;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;

/**
 * Behavioral tests for the container's public contract.
 */
final class ContainerTest extends TestCase {

	/**
	 * Consumers depend on the PSR-11 contract.
	 */
	public function test_implements_psr11_container_interface(): void {
		$this->assertInstanceOf( ContainerInterface::class, new Container() );
	}

	/**
	 * A registered entry is returned verbatim.
	 */
	public function test_get_returns_stored_value(): void {
		$container = new Container();
		$container->set( 'plugin.file', '/path/to/plugin.php' );

		$this->assertSame( '/path/to/plugin.php', $container->get( 'plugin.file' ) );
	}

	/**
	 * `has` reflects whether an entry was registered.
	 */
	public function test_has_reports_registration_state(): void {
		$container = new Container();
		$container->set( 'present', 'value' );

		$this->assertTrue( $container->has( 'present' ) );
		$this->assertFalse( $container->has( 'absent' ) );
	}

	/**
	 * A later `set` for the same id wins, as consumers reading it expect.
	 */
	public function test_set_overwrites_existing_entry(): void {
		$container = new Container();
		$container->set( 'key', 'first' );
		$container->set( 'key', 'second' );

		$this->assertSame( 'second', $container->get( 'key' ) );
	}

	/**
	 * Any value type round-trips, including a falsy `null`.
	 */
	public function test_get_returns_null_entry_without_treating_it_as_missing(): void {
		$container = new Container();
		$container->set( 'nullable', null );

		$this->assertTrue( $container->has( 'nullable' ) );
		$this->assertNull( $container->get( 'nullable' ) );
	}

	/**
	 * Requesting an unknown id surfaces the PSR-11 not-found error.
	 */
	public function test_get_throws_not_found_exception_for_unknown_id(): void {
		$container = new Container();

		$this->expectException( NotFoundExceptionInterface::class );
		$container->get( 'nonexistent' );
	}
}
