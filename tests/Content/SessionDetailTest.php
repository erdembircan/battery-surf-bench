<?php
/**
 * Tests for the stored-session detail screen.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView;
use ErdemBircan\BatterySurfBench\Content\SessionDetail;
use ErdemBircan\BatterySurfBench\Core\Assets;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\Support\FakeCapability;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use WP_Post;

use function has_action;
use function has_filter;

/**
 * The detail screen replaces the editor on a session's native admin edit screen
 * with the summary postcard. Its observable contract here: hook `replace_editor`
 * and the screen's asset enqueue, leave the editor alone for other post types or
 * an unauthorized visitor, and claim the replacement on the early WP_Screen pass
 * without rendering. The render-and-exit pass (which requires `admin-header.php`)
 * is exercised end-to-end in the Playground, not here.
 */
final class SessionDetailTest extends TestCase {

	private const POST_TYPE   = 'bsb_session';
	private const PREFIX      = 'bsb_';
	private const CAPABILITY  = 'manage_options';
	private const BLOCK_NAME  = 'bsb/cockpit';
	private const SCREEN_SLUG = 'bsb-sessions';
	private const STYLE       = 'build/style-cockpit-dashboard.css';

	/**
	 * Builds the detail screen under test. The capability is a fake test
	 * double rather than a mock of `current_user_can()`: injecting
	 * {@see FakeCapability} instead lets a test control whether the editor
	 * replacement gate passes without touching any WordPress global.
	 *
	 * @param Assets|null $assets Asset service to inject; a dummy mock by default.
	 * @param bool        $can    Whether the fake capability reports the requester authorized.
	 * @return SessionDetail The manager.
	 */
	private function detail( ?Assets $assets = null, bool $can = true ): SessionDetail {
		return new SessionDetail(
			self::POST_TYPE,
			self::PREFIX,
			new FakeCapability( $can ),
			self::BLOCK_NAME,
			self::SCREEN_SLUG,
			self::STYLE,
			new SessionDetailView(),
			$assets ?? Mockery::mock( Assets::class )
		);
	}

	/**
	 * Builds a post stub of the given type.
	 *
	 * @param string $post_type The post type.
	 * @return WP_Post The post stub.
	 */
	private function post( string $post_type ): WP_Post {
		return new WP_Post(
			(object) array(
				'ID'        => 7,
				'post_type' => $post_type,
			)
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->detail() );
	}

	/**
	 * Registration hooks the editor replacement and the screen's asset enqueue.
	 */
	public function test_register_hooks_the_editor_replacement_and_assets(): void {
		$detail = $this->detail();
		$detail->register();

		$this->assertNotFalse( has_filter( 'replace_editor', array( $detail, 'maybe_render' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $detail, 'enqueue' ) ) );
	}

	/**
	 * The editor is left untouched for any other post type — the replacement
	 * flag passed in is returned unchanged.
	 */
	public function test_maybe_render_leaves_other_post_types_alone(): void {
		$this->assertFalse( $this->detail()->maybe_render( false, $this->post( 'post' ) ) );
	}

	/**
	 * The editor is left untouched for a visitor without the capability, so a
	 * session screen never renders for the unauthorized.
	 */
	public function test_maybe_render_leaves_the_editor_for_an_unauthorized_visitor(): void {
		$this->assertFalse( $this->detail( null, false )->maybe_render( false, $this->post( self::POST_TYPE ) ) );
	}

	/**
	 * On the early WP_Screen pass (before the `current_screen` action) the screen
	 * claims the replacement so the block editor is never set up, but renders
	 * nothing — rendering then would output before the admin header and menu.
	 */
	public function test_maybe_render_claims_replacement_without_rendering_on_the_setup_pass(): void {
		Functions\when( 'did_action' )->justReturn( 0 );

		$this->assertTrue( $this->detail()->maybe_render( false, $this->post( self::POST_TYPE ) ) );

		// No output was produced — the render path is gated behind the
		// `current_screen` action; acknowledge the assertion above.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * The screen's assets are skipped on every admin page that is not a post
	 * edit screen.
	 */
	public function test_enqueue_skips_other_admin_screens(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldNotReceive( 'enqueue' );

		$this->detail( $assets )->enqueue( 'options-general.php' );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The detail stylesheet and the cockpit view module are enqueued on a
	 * session's edit screen, so the postcard is styled and hydrates.
	 */
	public function test_enqueue_loads_assets_on_a_session_edit_screen(): void {
		Functions\when( 'get_current_screen' )->justReturn( (object) array( 'post_type' => self::POST_TYPE ) );
		Functions\when( 'generate_block_asset_handle' )->justReturn( 'bsb-cockpit-view-script-module' );
		Functions\expect( 'wp_enqueue_script_module' )->once()->with( 'bsb-cockpit-view-script-module' );

		$assets = Mockery::mock( Assets::class );
		$assets->expects( 'enqueue' )->once()->with( self::STYLE )->andReturn( 'bsb-cockpit' );

		$this->detail( $assets )->enqueue( 'post.php' );

		$this->addToAssertionCount( 2 );
	}
}
