<?php
/**
 * Tests for the AI agent abilities manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\AbilityRegistry;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\Support\FakeCapability;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the abilities manager: that it hooks the two
 * Abilities API actions core registers through, registers its category and
 * every injected ability with core, and gates them all by the plugin's capability.
 */
final class AbilityRegistryTest extends TestCase {

	/**
	 * Builds an ability double with a name and a definition.
	 *
	 * @param string $name The ability name.
	 * @return Ability The double.
	 */
	private function ability( string $name ): Ability {
		$ability = Mockery::mock( Ability::class );
		$ability->shouldReceive( 'name' )->andReturn( $name );
		$ability->shouldReceive( 'definition' )->andReturn(
			array(
				'label'         => 'Label of ' . $name,
				'description'   => 'Description of ' . $name,
				'input_schema'  => array( 'type' => 'object' ),
				'output_schema' => array( 'type' => 'object' ),
				'annotations'   => array( 'readonly' => true ),
			)
		);

		return $ability;
	}

	/** The bootstrap relies on every manager honouring the contract, and core accepts registration only inside its own two actions. */
	public function test_it_is_a_manager_hooking_the_two_abilities_api_actions(): void {
		$registry = new AbilityRegistry( 'battery-surf-bench', new FakeCapability(), array() );
		$registry->register();

		$this->assertInstanceOf( Manager::class, $registry );
		$this->assertNotFalse( has_action( 'wp_abilities_api_categories_init', array( $registry, 'register_category' ) ) );
		$this->assertNotFalse( has_action( 'wp_abilities_api_init', array( $registry, 'register_abilities' ) ) );
	}

	/** Constructing and registering asks no ability for its definition: it translates strings, which must wait until `init`. */
	public function test_it_never_asks_an_ability_for_its_definition_before_core_does(): void {
		$ability = Mockery::mock( Ability::class );
		$ability->shouldNotReceive( 'definition' );

		( new AbilityRegistry( 'battery-surf-bench', new FakeCapability(), array( $ability ) ) )->register();

		$this->addToAssertionCount( 1 );
	}

	/** The category is registered under its slug, with a translated label and description. */
	public function test_register_category_registers_the_slug_with_its_label_and_description(): void {
		Functions\expect( 'wp_register_ability_category' )
			->once()
			->with(
				'battery-surf-bench',
				array(
					'label'       => 'Battery Surf Bench',
					'description' => 'Battery benchmark runs recorded on this site, and the course of pages the simulated surfer visits during a benchmark.',
				)
			);

		( new AbilityRegistry( 'battery-surf-bench', new FakeCapability(), array() ) )->register_category();

		$this->addToAssertionCount( 1 );
	}

	/** Every ability is registered once, filed under the category, shown over REST and public for the MCP Adapter, with only the keys core accepts. */
	public function test_register_abilities_registers_each_ability_with_core(): void {
		$first      = $this->ability( 'battery-surf-bench/first' );
		$registry   = new AbilityRegistry( 'battery-surf-bench', new FakeCapability(), array( $first, $this->ability( 'battery-surf-bench/second' ) ) );
		$registered = array();

		Functions\expect( 'wp_register_ability' )
			->twice()
			->andReturnUsing(
				static function ( string $name, array $args ) use ( &$registered ) {
					$registered[ $name ] = $args;

					return null;
				}
			);

		$registry->register_abilities();

		$args = $registered['battery-surf-bench/first'];

		$this->assertSame( array( 'battery-surf-bench/first', 'battery-surf-bench/second' ), array_keys( $registered ) );
		$this->assertEqualsCanonicalizing(
			array( 'label', 'description', 'category', 'input_schema', 'output_schema', 'execute_callback', 'permission_callback', 'meta' ),
			array_keys( $args )
		);
		$this->assertSame( 'Label of battery-surf-bench/first', $args['label'] );
		$this->assertSame( 'battery-surf-bench', $args['category'] );
		$this->assertSame( array( $first, 'execute' ), $args['execute_callback'] );
		$this->assertSame( array( $registry, 'can_run' ), $args['permission_callback'] );
		$this->assertSame( array( 'readonly' => true ), $args['meta']['annotations'] );
		$this->assertTrue( $args['meta']['show_in_rest'] );
		$this->assertSame(
			array(
				'public' => true,
				'type'   => 'tool',
			),
			$args['meta']['mcp']
		);
	}

	/** Running an ability is allowed exactly when the plugin's capability is. */
	public function test_can_run_follows_the_capability(): void {
		$this->assertTrue( ( new AbilityRegistry( 'battery-surf-bench', new FakeCapability( true ), array() ) )->can_run() );
		$this->assertFalse( ( new AbilityRegistry( 'battery-surf-bench', new FakeCapability( false ), array() ) )->can_run() );
	}
}
