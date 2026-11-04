<?php
/**
 * Tests for the capability-gated benchmark sessions REST controller.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Content\SessionRestController;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use WP_Error;

/**
 * Behavioral tests for the controller's two overridden read-permission
 * methods: an anonymous or under-privileged request is refused with a
 * `rest_forbidden` error carrying the correct status, while a request that
 * holds the post type's capability is delegated to core (proven by the
 * parent stub's permissive return value coming through unchanged).
 */
final class SessionRestControllerTest extends TestCase {

	private const POST_TYPE = 'bsbench_session';

	/**
	 * Builds the controller under test for the session post type.
	 *
	 * @return SessionRestController The controller under test.
	 */
	private function controller(): SessionRestController {
		return new SessionRestController( self::POST_TYPE );
	}

	/**
	 * Stubs `get_post_type_object()` to return a double whose capability map
	 * resolves `edit_posts` to the plugin capability, matching how
	 * {@see \ErdemBircan\BatterySurfBench\Content\SessionType} registers it.
	 *
	 * @return void
	 */
	private function stub_post_type_object(): void {
		Functions\when( 'get_post_type_object' )->justReturn(
			(object) array(
				'cap' => (object) array( 'edit_posts' => 'manage_options' ),
			)
		);
	}

	/**
	 * A dummy request double: the controller's own gate never inspects it, and
	 * on the allowed path the parent stub ignores it too.
	 *
	 * @return \WP_REST_Request The request double.
	 */
	private function request() {
		return Mockery::mock( 'WP_REST_Request' );
	}

	/**
	 * An anonymous collection read is refused with a `rest_forbidden` error
	 * carrying the status `rest_authorization_required_code()` reports for a
	 * logged-out visitor.
	 */
	public function test_get_items_permissions_check_denies_without_the_capability(): void {
		$this->stub_post_type_object();
		Functions\when( 'current_user_can' )->justReturn( false );
		Functions\when( 'rest_authorization_required_code' )->justReturn( 401 );

		$result = $this->controller()->get_items_permissions_check( $this->request() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'rest_forbidden', $result->get_error_code() );
		$this->assertSame( array( 'status' => 401 ), $result->get_error_data() );
	}

	/**
	 * A single-item read is refused the same way as the collection read.
	 */
	public function test_get_item_permissions_check_denies_without_the_capability(): void {
		$this->stub_post_type_object();
		Functions\when( 'current_user_can' )->justReturn( false );
		Functions\when( 'rest_authorization_required_code' )->justReturn( 401 );

		$result = $this->controller()->get_item_permissions_check( $this->request() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'rest_forbidden', $result->get_error_code() );
		$this->assertSame( array( 'status' => 401 ), $result->get_error_data() );
	}

	/**
	 * A collection read is delegated to core once the capability check passes
	 * — proven by the parent stub's permissive `true` coming through, rather
	 * than the controller short-circuiting the decision itself.
	 */
	public function test_get_items_permissions_check_delegates_to_core_with_the_capability(): void {
		$this->stub_post_type_object();
		Functions\when( 'current_user_can' )->justReturn( true );

		$result = $this->controller()->get_items_permissions_check( $this->request() );

		$this->assertTrue( $result );
	}

	/**
	 * A single-item read is delegated to core once the capability check
	 * passes, matching the collection-read behaviour above.
	 */
	public function test_get_item_permissions_check_delegates_to_core_with_the_capability(): void {
		$this->stub_post_type_object();
		Functions\when( 'current_user_can' )->justReturn( true );

		$result = $this->controller()->get_item_permissions_check( $this->request() );

		$this->assertTrue( $result );
	}
}
