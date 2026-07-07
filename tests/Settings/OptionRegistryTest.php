<?php
/**
 * Tests for the plugin options manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Settings;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Settings\OptionRegistry;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the general options manager: that it hooks its own
 * registration onto `init`, that it only asks each provider for its
 * definition once actually registering (never eagerly at construction), and
 * that it registers every injected provider — proven with more than one
 * provider, since being genuinely general (not dedicated to a single option)
 * is the entire point of this class.
 */
final class OptionRegistryTest extends TestCase {

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, new OptionRegistry( array() ) );
	}

	/**
	 * Registering hooks the registry's own option registration onto `init`.
	 */
	public function test_register_hooks_register_options_onto_init(): void {
		$registry = new OptionRegistry( array() );
		$registry->register();

		$this->assertNotFalse( has_action( 'init', array( $registry, 'register_options' ) ) );
	}

	/**
	 * Constructing the registry never asks an injected provider for its
	 * definition — a definition's args may legitimately call `__()`, which
	 * WordPress requires never runs before `init`, so nothing may build one
	 * before `register_options()` (the `init` callback) actually runs.
	 */
	public function test_construction_never_asks_a_provider_for_its_definition(): void {
		$provider = new FakeOptionProvider(
			array(
				'name' => 'bsb_fake_option',
				'args' => array( 'type' => 'string' ),
			)
		);

		new OptionRegistry( array( $provider ) );

		$this->assertFalse( $provider->was_asked );
	}

	/**
	 * A single injected provider's definition is registered with its own name
	 * and args.
	 */
	public function test_register_options_registers_a_single_providers_definition(): void {
		$provider = new FakeOptionProvider(
			array(
				'name' => 'bsb_fake_option',
				'args' => array( 'type' => 'string' ),
			)
		);

		Functions\expect( 'register_setting' )
			->once()
			->with( Mockery::type( 'string' ), 'bsb_fake_option', array( 'type' => 'string' ) );

		( new OptionRegistry( array( $provider ) ) )->register_options();

		$this->assertTrue( $provider->was_asked );
	}

	/**
	 * Every injected provider's definition is registered, each with its own
	 * name and args — proving the registry is genuinely general rather than
	 * only ever handling one option.
	 */
	public function test_register_options_registers_every_providers_definition(): void {
		$provider_a = new FakeOptionProvider(
			array(
				'name' => 'bsb_fake_option_a',
				'args' => array( 'type' => 'string' ),
			)
		);
		$provider_b = new FakeOptionProvider(
			array(
				'name' => 'bsb_fake_option_b',
				'args' => array( 'type' => 'array' ),
			)
		);

		Functions\expect( 'register_setting' )
			->once()
			->with( Mockery::type( 'string' ), 'bsb_fake_option_a', array( 'type' => 'string' ) );
		Functions\expect( 'register_setting' )
			->once()
			->with( Mockery::type( 'string' ), 'bsb_fake_option_b', array( 'type' => 'array' ) );

		( new OptionRegistry( array( $provider_a, $provider_b ) ) )->register_options();

		$this->assertTrue( $provider_a->was_asked );
		$this->assertTrue( $provider_b->was_asked );
	}
}
