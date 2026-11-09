<?php
/**
 * Tests for the stored-session detail page.
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
 * The detail page shows one stored session's summary postcard on a hidden admin
 * page under the plugin menu. Its observable contract: hook the page, its menu
 * removal, the Sessions highlight and its assets; register the page under the
 * plugin menu with the plugin capability; end the request with a 404 for an
 * unknown or foreign session id; print the postcard for a real one; and load
 * its assets, and highlight Sessions, only on its own page.
 */
final class SessionDetailTest extends TestCase {

	private const POST_TYPE   = 'bsbench_session';
	private const PREFIX      = 'bsbench_';
	private const CAPABILITY  = 'manage_options';
	private const BLOCK_NAME  = 'battery-surf-bench/cockpit';
	private const PARENT      = 'battery-surf-bench';
	private const PAGE_SLUG   = 'bsbench-session';
	private const SCREEN_SLUG = 'bsbench-sessions';
	private const PARAM       = 'bsbenchSessionId';
	private const STYLE       = 'build/style-cockpit-dashboard.css';
	private const HOOK        = 'battery-surf-bench_page_bsbench-session';

	/**
	 * Builds the detail page under test. The capability is a fake test double
	 * rather than a mock of `current_user_can()`.
	 *
	 * @param Assets|null $assets Asset service to inject; a dummy mock by default.
	 * @return SessionDetail The manager.
	 */
	private function detail( ?Assets $assets = null ): SessionDetail {
		return new SessionDetail(
			self::POST_TYPE,
			self::PREFIX,
			new FakeCapability( true, self::CAPABILITY ),
			self::BLOCK_NAME,
			self::PARENT,
			self::PAGE_SLUG,
			self::SCREEN_SLUG,
			self::PARAM,
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
	 * Registers the page, as the `admin_menu` action does, against a stubbed
	 * `add_submenu_page` that hands back the page's hook suffix.
	 *
	 * @param SessionDetail $detail The manager.
	 */
	private function add_page( SessionDetail $detail ): void {
		Functions\when( 'add_submenu_page' )->justReturn( self::HOOK );

		$detail->add_page();
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->detail() );
	}

	/**
	 * Registration hooks the page, its removal from the menu, the Sessions
	 * highlight and the page's asset enqueue.
	 */
	public function test_register_hooks_the_page_the_menu_handling_and_assets(): void {
		$detail = $this->detail();
		$detail->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $detail, 'add_page' ) ) );
		$this->assertNotFalse( has_action( 'admin_head', array( $detail, 'hide_page' ) ) );
		$this->assertNotFalse( has_filter( 'submenu_file', array( $detail, 'highlight_listing' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $detail, 'enqueue' ) ) );
	}

	/**
	 * The page is placed under the plugin menu, gated by the plugin capability,
	 * and rendered by the manager.
	 */
	public function test_add_page_registers_a_submenu_page_under_the_plugin_menu(): void {
		Functions\expect( 'add_submenu_page' )
			->once()
			->with(
				self::PARENT,
				'Benchmark Session',
				'Benchmark Session',
				self::CAPABILITY,
				self::PAGE_SLUG,
				Mockery::on(
					static fn( $callback ) => is_array( $callback ) && 'render' === $callback[1]
				)
			)
			->andReturn( self::HOOK );

		$detail = $this->detail();
		$detail->add_page();

		$this->assertNotFalse( has_action( 'load-' . self::HOOK, array( $detail, 'load' ) ) );
	}

	/**
	 * The page leaves the plugin menu: its menu item is removed.
	 */
	public function test_hide_page_removes_the_page_from_the_plugin_menu(): void {
		Functions\expect( 'remove_submenu_page' )->once()->with( self::PARENT, self::PAGE_SLUG );

		$this->detail()->hide_page();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * While the detail page shows, the Sessions item is the highlighted one.
	 */
	public function test_highlight_listing_selects_sessions_on_the_detail_page(): void {
		$detail = $this->detail();
		$this->add_page( $detail );
		Functions\when( 'get_current_screen' )->justReturn( (object) array( 'id' => self::HOOK ) );

		$this->assertSame( self::SCREEN_SLUG, $detail->highlight_listing( self::PAGE_SLUG ) );
	}

	/**
	 * On any other screen the highlight WordPress chose passes through.
	 */
	public function test_highlight_listing_passes_other_screens_through(): void {
		$detail = $this->detail();
		$this->add_page( $detail );
		Functions\when( 'get_current_screen' )->justReturn( (object) array( 'id' => 'plugins' ) );

		$this->assertSame( 'plugins.php', $detail->highlight_listing( 'plugins.php' ) );
	}

	/**
	 * An id that names no post ends the request with a 404 page.
	 */
	public function test_load_ends_the_request_with_a_404_for_an_unknown_session(): void {
		Functions\when( 'filter_input' )->justReturn( 99 );
		Functions\when( 'get_post' )->justReturn( null );
		Functions\when( 'admin_url' )->returnArg();
		Functions\expect( 'wp_die' )
			->once()
			->with(
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				Mockery::on( static fn( $args ) => 404 === $args['response'] )
			);

		$this->detail()->load();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * A missing or malformed id parameter ends the request with a 404 page too.
	 */
	public function test_load_ends_the_request_with_a_404_when_the_id_is_missing(): void {
		Functions\when( 'filter_input' )->justReturn( null );
		Functions\when( 'admin_url' )->returnArg();
		Functions\expect( 'wp_die' )
			->once()
			->with(
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				Mockery::on( static fn( $args ) => 404 === $args['response'] )
			);

		$this->detail()->load();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * A post of another type is no session: it gets the same 404.
	 */
	public function test_load_ends_the_request_with_a_404_for_a_post_of_another_type(): void {
		Functions\when( 'filter_input' )->justReturn( 7 );
		Functions\when( 'get_post' )->justReturn( $this->post( 'post' ) );
		Functions\when( 'admin_url' )->returnArg();
		Functions\expect( 'wp_die' )
			->once()
			->with(
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				Mockery::on( static fn( $args ) => 404 === $args['response'] )
			);

		$this->detail()->load();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * A real session loads without ending the request, and the page blanks the
	 * admin footer text.
	 */
	public function test_load_accepts_a_session_and_blanks_the_footer_text(): void {
		Functions\when( 'filter_input' )->justReturn( 7 );
		Functions\when( 'get_post' )->justReturn( $this->post( self::POST_TYPE ) );
		Functions\expect( 'wp_die' )->never();

		$this->detail()->load();

		$this->assertNotFalse( has_filter( 'admin_footer_text', '__return_empty_string' ) );
		$this->assertNotFalse( has_filter( 'update_footer', '__return_empty_string' ) );
	}

	/**
	 * The page prints the summary postcard of the session it loaded.
	 */
	public function test_render_prints_the_session_postcard(): void {
		Functions\when( 'filter_input' )->justReturn( 7 );
		Functions\when( 'get_post' )->justReturn( $this->post( self::POST_TYPE ) );
		Functions\when( 'get_post_meta' )->justReturn( '' );
		Functions\when( 'admin_url' )->returnArg();

		$detail = $this->detail();
		$detail->load();

		$this->expectOutputRegex( '/<div class="bsb-session-detail"[^>]*data-wp-context="/' );

		$detail->render();
	}

	/**
	 * The page's assets are skipped on every admin page but its own.
	 */
	public function test_enqueue_skips_other_admin_screens(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldNotReceive( 'enqueue' );

		$detail = $this->detail( $assets );
		$this->add_page( $detail );
		$detail->enqueue( 'options-general.php' );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The detail stylesheet and the cockpit view module are enqueued on the
	 * detail page, so the postcard is styled and hydrates.
	 */
	public function test_enqueue_loads_assets_on_the_detail_page(): void {
		Functions\when( 'generate_block_asset_handle' )->justReturn( 'battery-surf-bench-cockpit-view-script-module' );
		Functions\expect( 'wp_enqueue_script_module' )->once()->with( 'battery-surf-bench-cockpit-view-script-module' );

		$assets = Mockery::mock( Assets::class );
		$assets->expects( 'enqueue' )->once()->with( self::STYLE )->andReturn( 'bsb-cockpit' );

		$detail = $this->detail( $assets );
		$this->add_page( $detail );
		$detail->enqueue( self::HOOK );

		$this->addToAssertionCount( 2 );
	}
}
