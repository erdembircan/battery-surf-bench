<?php
/**
 * Tests for the singleton instance store.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Container;

use ErdemBircan\BatterySurfBench\Container\InstanceStore;
use ErdemBircan\BatterySurfBench\Tests\Fixtures\FixtureEngine;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;

/**
 * Behavioral tests for the instance store's public contract.
 */
final class InstanceStoreTest extends TestCase {

	/**
	 * Consumers depend on the PSR-11 contract.
	 */
	public function test_implements_psr11_container_interface(): void {
		$this->assertInstanceOf( ContainerInterface::class, new InstanceStore() );
	}

	/**
	 * `has` reflects whether an instance has been stored under an id.
	 */
	public function test_has_reports_storage_state(): void {
		$store    = new InstanceStore();
		$instance = new FixtureEngine();

		$this->assertFalse( $store->has( FixtureEngine::class ) );

		$store->set( FixtureEngine::class, $instance );

		$this->assertTrue( $store->has( FixtureEngine::class ) );
	}

	/**
	 * A stored instance is returned by identity, which every consumer of the
	 * singleton cache relies on.
	 */
	public function test_get_returns_the_same_instance_that_was_set(): void {
		$store    = new InstanceStore();
		$instance = new FixtureEngine();

		$store->set( FixtureEngine::class, $instance );

		$this->assertSame( $instance, $store->get( FixtureEngine::class ) );
	}

	/**
	 * Requesting an unstored id surfaces the PSR-11 not-found error.
	 */
	public function test_get_throws_not_found_exception_for_unknown_id(): void {
		$store = new InstanceStore();

		$this->expectException( NotFoundExceptionInterface::class );
		$store->get( FixtureEngine::class );
	}
}
