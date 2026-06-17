<?php
/**
 * Tests for the benchmark session post type manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Content\SessionType;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the post type manager: the hooks it registers, the kind
 * of post type and meta it hands WordPress, and the access policy it enforces.
 */
final class SessionTypeTest extends TestCase {

	private const POST_TYPE  = 'bsb_session';
	private const PREFIX     = 'bsb_';
	private const CAPABILITY = 'manage_options';

	/**
	 * Builds a post type manager backed by a real schema.
	 *
	 * @return SessionType The manager under test.
	 */
	private function type(): SessionType {
		return new SessionType(
			new SessionSchema( self::POST_TYPE, self::PREFIX ),
			self::CAPABILITY
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
	 * The post type is registered headless and over REST: kept out of the admin
	 * menu so the DataViews screen owns the listing, but reachable through REST
	 * so that screen and the cockpit can read and write sessions.
	 */
	public function test_registers_a_headless_rest_enabled_post_type(): void {
		Functions\expect( 'register_post_type' )
			->once()
			->with(
				self::POST_TYPE,
				Mockery::on(
					static function ( $args ) {
						return true === $args['show_in_rest']
							&& false === $args['show_in_menu']
							&& false === $args['public'];
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
	 * The access policy is uniform: a meta write is authorized only for holders
	 * of the plugin's capability.
	 */
	public function test_can_edit_requires_the_plugin_capability(): void {
		Functions\expect( 'current_user_can' )
			->once()
			->with( self::CAPABILITY )
			->andReturn( true );

		$this->assertTrue( $this->type()->can_edit() );
	}
}
