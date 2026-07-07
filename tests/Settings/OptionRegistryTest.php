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
 * registration onto `init`, and that it registers every injected definition —
 * proven with more than one definition, since being genuinely general (not
 * dedicated to a single option) is the entire point of this class.
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
	 * A single injected definition is registered with its own name and args.
	 */
	public function test_register_options_registers_a_single_definition(): void {
		Functions\expect( 'register_setting' )
			->once()
			->with( Mockery::type( 'string' ), 'bsb_fake_option', array( 'type' => 'string' ) );

		( new OptionRegistry(
			array(
				array(
					'name' => 'bsb_fake_option',
					'args' => array( 'type' => 'string' ),
				),
			)
		) )->register_options();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Every injected definition is registered, each with its own name and
	 * args — proving the registry is genuinely general rather than only ever
	 * handling one option.
	 */
	public function test_register_options_registers_every_definition(): void {
		Functions\expect( 'register_setting' )
			->once()
			->with( Mockery::type( 'string' ), 'bsb_fake_option_a', array( 'type' => 'string' ) );
		Functions\expect( 'register_setting' )
			->once()
			->with( Mockery::type( 'string' ), 'bsb_fake_option_b', array( 'type' => 'array' ) );

		( new OptionRegistry(
			array(
				array(
					'name' => 'bsb_fake_option_a',
					'args' => array( 'type' => 'string' ),
				),
				array(
					'name' => 'bsb_fake_option_b',
					'args' => array( 'type' => 'array' ),
				),
			)
		) )->register_options();

		$this->addToAssertionCount( 1 );
	}
}
