<?php
/**
 * Tests for the benchmark session post type manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Content\SessionRestController;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Content\SessionType;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\Support\FakeCapability;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the post type manager: the hooks it registers, the kind
 * of post type and meta it hands WordPress, and the access policy it enforces.
 */
final class SessionTypeTest extends TestCase {

	private const POST_TYPE  = 'bsbench_session';
	private const PREFIX     = 'bsbench_';
	private const CAPABILITY = 'manage_options';

	/**
	 * Builds a post type manager backed by a real schema. The capability is a
	 * fake test double rather than a mock of `current_user_can()`: injecting
	 * {@see FakeCapability} instead lets a test control the access policy
	 * directly, without touching any WordPress global.
	 *
	 * @param FakeCapability|null $capability Capability double to inject, or a fixed-allow one by default.
	 * @return SessionType The manager under test.
	 */
	private function type( ?FakeCapability $capability = null ): SessionType {
		return new SessionType(
			new SessionSchema( self::POST_TYPE, self::PREFIX ),
			$capability ?? new FakeCapability( true, self::CAPABILITY )
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->type() );
	}

	/**
	 * Registration is deferred to `init`, where WordPress expects content types
	 * and their meta to be declared.
	 */
	public function test_register_hooks_registration_onto_init(): void {
		$type = $this->type();
		$type->register();

		$this->assertNotFalse( has_action( 'init', array( $type, 'register_post_type' ) ) );
		$this->assertNotFalse( has_action( 'init', array( $type, 'register_meta' ) ) );
	}

	/**
	 * The post type is headless — no front end, no menu entry and no native admin
	 * screens (the DataViews screen lists sessions, the detail page shows one) —
	 * and stays reachable over REST so the screen and the cockpit can read and
	 * write sessions.
	 */
	public function test_registers_a_headless_rest_enabled_post_type(): void {
		Functions\expect( 'register_post_type' )
			->once()
			->with(
				self::POST_TYPE,
				Mockery::on(
					static function ( $args ) {
						return true === $args['show_in_rest']
							&& false === $args['show_ui']
							&& false === $args['show_in_menu']
							&& false === $args['public']
							&& false === $args['publicly_queryable'];
					}
				)
			);

		$this->type()->register_post_type();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Access is gated entirely behind the plugin capability with meta-cap
	 * mapping off, so even capability checks that carry no specific post (such
	 * as the REST controller deciding whether the collection allows DELETE)
	 * resolve to a plain primitive instead of warning that a post is required.
	 */
	public function test_post_type_gates_every_capability_behind_the_plugin_capability(): void {
		Functions\expect( 'register_post_type' )
			->once()
			->with(
				self::POST_TYPE,
				Mockery::on(
					static function ( $args ) {
						if ( false !== $args['map_meta_cap'] ) {
							return false;
						}

						$gated = array(
							'edit_post',
							'read_post',
							'delete_post',
							'edit_posts',
							'create_posts',
							'delete_posts',
						);

						foreach ( $gated as $cap ) {
							if ( self::CAPABILITY !== ( $args['capabilities'][ $cap ] ?? null ) ) {
								return false;
							}
						}

						return true;
					}
				)
			);

		$this->type()->register_post_type();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The post type is registered with the custom controller class, so the
	 * capability gate on the published-post read paths ({@see SessionRestController})
	 * is actually wired in, not merely defined.
	 */
	public function test_registers_the_custom_rest_controller_class(): void {
		Functions\expect( 'register_post_type' )
			->once()
			->with(
				self::POST_TYPE,
				Mockery::on(
					static function ( $args ) {
						return SessionRestController::class === ( $args['rest_controller_class'] ?? null );
					}
				)
			);

		$this->type()->register_post_type();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Every session datum is registered as post meta under the schema's
	 * prefixed key, each guarded by an auth callback — the manager's access
	 * policy — so writes are gated even over REST.
	 */
	public function test_registers_each_datum_as_guarded_prefixed_meta(): void {
		$calls = array();

		Functions\when( 'register_post_meta' )->alias(
			static function ( $post_type, $key, $args ) use ( &$calls ): bool {
				$calls[] = array(
					'post_type' => $post_type,
					'key'       => $key,
					'args'      => $args,
				);
				return true;
			}
		);

		$this->type()->register_meta();

		$this->assertNotEmpty( $calls );

		foreach ( $calls as $call ) {
			$this->assertSame( self::POST_TYPE, $call['post_type'] );
			$this->assertStringStartsWith( self::PREFIX, $call['key'] );
			$this->assertIsCallable( $call['args']['auth_callback'] );
		}
	}

	/**
	 * The access policy delegates entirely to the injected capability: a meta
	 * write is authorized exactly when the capability says so, and refused
	 * exactly when it doesn't — proven here with a fake instead of mocking
	 * `current_user_can()`.
	 */
	public function test_can_edit_delegates_to_the_injected_capability(): void {
		$this->assertTrue( $this->type( new FakeCapability( true ) )->can_edit() );
		$this->assertFalse( $this->type( new FakeCapability( false ) )->can_edit() );
	}
}
