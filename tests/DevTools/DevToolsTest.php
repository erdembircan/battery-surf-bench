<?php
/**
 * Tests for the environment-gated dev-tools manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\DevTools;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Core\Assets;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\DevTools\DevTools;
use ErdemBircan\BatterySurfBench\DevTools\Views\DevToolsPanelView;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;
use function has_filter;
use function htmlspecialchars;
use function wp_json_encode;

/**
 * The manager's whole job is the gate: closed, it registers nothing at all —
 * no hook, no enqueue, no dev-tools byte on a production request. Open, it
 * renders the panel through a filter (so the cockpit dashboard that hosts it
 * stays ignorant of dev tooling) and enqueues its module/stylesheet on the
 * cockpit dashboard's own front-end route only.
 */
final class DevToolsTest extends TestCase {

	private const ENVIRONMENTS  = array( 'local', 'development' );
	private const MODULE        = 'build/devtools/view.js';
	private const STYLE         = 'build/style-devtools.css';
	private const COCKPIT_PARAM = 'bsbenchSession';
	private const COCKPIT_VALUE = 'cockpit';
	private const COURSE_OPTION = 'bsbench_course_order';

	/**
	 * Builds the manager under test.
	 *
	 * @param Assets|null               $assets         Asset service to inject; a dummy mock by default.
	 * @param CourseOrderSanitizer|null $order_sanitizer Sanitizer to inject; a real one restricted to pages/posts by default, the same as CourseRouterTest builds.
	 * @return DevTools The manager.
	 */
	private function devtools( ?Assets $assets = null, ?CourseOrderSanitizer $order_sanitizer = null ): DevTools {
		return new DevTools(
			self::ENVIRONMENTS,
			self::MODULE,
			self::STYLE,
			$assets ?? Mockery::mock( Assets::class ),
			self::COCKPIT_PARAM,
			self::COCKPIT_VALUE,
			new DevToolsPanelView(),
			$order_sanitizer ?? new CourseOrderSanitizer( new CourseCatalog( '/plugin/includes/Course/content' ), array( 'page', 'post' ) ),
			self::COURSE_OPTION
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->devtools() );
	}

	/**
	 * `is_active()` reads the plugin's configured allow-list against the
	 * environment WordPress reports.
	 */
	public function test_is_active_matches_configured_environments(): void {
		Functions\when( 'wp_get_environment_type' )->justReturn( 'development' );
		$this->assertTrue( $this->devtools()->is_active() );

		Functions\when( 'wp_get_environment_type' )->justReturn( 'local' );
		$this->assertTrue( $this->devtools()->is_active() );

		Functions\when( 'wp_get_environment_type' )->justReturn( 'production' );
		$this->assertFalse( $this->devtools()->is_active() );

		Functions\when( 'wp_get_environment_type' )->justReturn( 'staging' );
		$this->assertFalse( $this->devtools()->is_active() );
	}

	/**
	 * On a closed gate, registration hooks nothing at all: no filter, no action.
	 * A production (or staging) request must not carry any dev-tools trace.
	 */
	public function test_register_hooks_nothing_when_the_gate_is_closed(): void {
		Functions\when( 'wp_get_environment_type' )->justReturn( 'production' );

		$devtools = $this->devtools();
		$devtools->register();

		$this->assertFalse( has_filter( 'battery_surf_bench_devtools_panel', array( $devtools, 'render_panel' ) ) );
		$this->assertFalse(
			has_filter( 'battery_surf_bench_cockpit_spared_style_handles', array( $devtools, 'spare_style_handle' ) )
		);
		$this->assertFalse( has_action( 'wp_enqueue_scripts', array( $devtools, 'enqueue_front' ) ) );
	}

	/**
	 * On an open gate, registration wires the panel filter, the spared-style
	 * filter and both enqueue hooks.
	 */
	public function test_register_hooks_everything_when_the_gate_is_open(): void {
		Functions\when( 'wp_get_environment_type' )->justReturn( 'development' );

		$devtools = $this->devtools();
		$devtools->register();

		$this->assertNotFalse( has_filter( 'battery_surf_bench_devtools_panel', array( $devtools, 'render_panel' ) ) );
		$this->assertNotFalse(
			has_filter( 'battery_surf_bench_cockpit_spared_style_handles', array( $devtools, 'spare_style_handle' ) )
		);
		$this->assertNotFalse( has_action( 'wp_enqueue_scripts', array( $devtools, 'enqueue_front' ) ) );
	}

	/**
	 * However open the gate is, this manager never hooks the admin's own
	 * enqueue action — dev tools belong to the cockpit dashboard (front end)
	 * only, and must never register, enqueue or render on any admin screen.
	 */
	public function test_register_never_hooks_admin_enqueue(): void {
		Functions\when( 'wp_get_environment_type' )->justReturn( 'development' );

		$this->devtools()->register();

		$this->assertFalse( has_action( 'admin_enqueue_scripts' ) );
	}

	/**
	 * The front-end enqueue is skipped off the cockpit dashboard route — the
	 * same query parameter/value {@see Cockpit} itself renders the dashboard on.
	 */
	public function test_enqueue_front_skips_non_cockpit_requests(): void {
		Functions\when( 'get_query_var' )->justReturn( '' );
		Functions\when( 'sanitize_key' )->returnArg();

		$assets = Mockery::mock( Assets::class );
		$assets->shouldNotReceive( 'enqueue' );
		$assets->shouldNotReceive( 'register_script_module' );

		$this->devtools( $assets )->enqueue_front();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * On the cockpit dashboard route, the stylesheet and the view module (with
	 * its translations) are registered and enqueued.
	 */
	public function test_enqueue_front_loads_assets_on_the_cockpit_route(): void {
		Functions\when( 'get_query_var' )->justReturn( self::COCKPIT_VALUE );
		Functions\when( 'sanitize_key' )->returnArg();

		$assets = Mockery::mock( Assets::class );
		$assets->expects( 'enqueue' )->once()->with( self::STYLE )->andReturn( 'bsb-devtools' );
		$assets->expects( 'register_script_module' )
			->once()
			->with( self::MODULE, array( '@wordpress/interactivity' ) )
			->andReturn( 'bsb-devtools-view' );
		$assets->expects( 'set_script_module_translations' )->once()->with( 'bsb-devtools-view' );
		$assets->expects( 'enqueue_script_module' )->once()->with( 'bsb-devtools-view' );

		$this->devtools( $assets )->enqueue_front();

		$this->addToAssertionCount( 4 );
	}

	/**
	 * The devtools stylesheet handle is spared only once an enqueue call has
	 * actually happened — before that, the filter passes handles through
	 * untouched rather than appending an unknown handle.
	 */
	public function test_spare_style_handle_is_a_passthrough_before_any_enqueue(): void {
		$this->assertSame( array( 'theme-style' ), $this->devtools()->spare_style_handle( array( 'theme-style' ) ) );
	}

	/**
	 * Once the stylesheet has been enqueued, its handle is appended to the
	 * spared list so the cockpit dashboard's strip leaves it in place.
	 */
	public function test_spare_style_handle_appends_the_enqueued_handle(): void {
		Functions\when( 'get_query_var' )->justReturn( self::COCKPIT_VALUE );
		Functions\when( 'sanitize_key' )->returnArg();

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'enqueue' )->andReturn( 'bsb-devtools' );
		$assets->shouldReceive( 'register_script_module' )->andReturn( 'bsb-devtools-view' );
		$assets->shouldReceive( 'set_script_module_translations' );
		$assets->shouldReceive( 'enqueue_script_module' );

		$devtools = $this->devtools( $assets );
		$devtools->enqueue_front();

		$this->assertSame(
			array( 'theme-style', 'bsb-devtools' ),
			$devtools->spare_style_handle( array( 'theme-style' ) )
		);
	}

	/**
	 * The panel filter appends the rendered panel markup to whatever the filter
	 * chain already carries, rather than overwriting it.
	 */
	public function test_render_panel_appends_to_the_filter_chain(): void {
		Functions\when( 'get_option' )->justReturn( array() );

		$markup = $this->devtools()->render_panel( '<div id="other"></div>' );

		$this->assertStringStartsWith( '<div id="other"></div>', $markup );
		$this->assertStringContainsString( 'class="bsb-devtools"', $markup );
	}

	/**
	 * `course_slugs()` reads the saved surf-course order from the exact same
	 * option, and sanitizes it with the exact same CourseOrderSanitizer, that
	 * CourseRouter resolves indexes against — proven here by staging a
	 * fresh-install (unsaved) order and asserting the panel receives the
	 * bundled catalog's own slugs, in catalog order.
	 */
	public function test_render_panel_hands_the_panel_the_default_bundled_slugs_when_no_order_is_saved(): void {
		$order_sanitizer = new CourseOrderSanitizer( new CourseCatalog( '/plugin/includes/Course/content' ), array( 'page', 'post' ) );
		Functions\expect( 'get_option' )
			->once()
			->with( self::COURSE_OPTION, $order_sanitizer->default_order() )
			->andReturn( $order_sanitizer->default_order() );

		$markup = $this->devtools( null, $order_sanitizer )->render_panel();

		$this->assertStringContainsString(
			'data-devtools-course-slugs="' . self::expected_slugs_attr( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ) ) . '"',
			$markup
		);
	}

	/**
	 * A saved order shorter than the full bundled set resolves to exactly
	 * those slugs, in the saved order — never re-padded with the missing
	 * bundled pages, the same "a saved order is authoritative" rule
	 * CourseOrderSanitizer documents for CourseRouter's own index resolution.
	 */
	public function test_render_panel_hands_the_panel_a_saved_orders_own_slugs(): void {
		$order_sanitizer = new CourseOrderSanitizer( new CourseCatalog( '/plugin/includes/Course/content' ), array( 'page', 'post' ) );
		Functions\when( 'get_option' )->justReturn(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'gallery',
				),
				array(
					'kind' => 'bundled',
					'slug' => 'video',
				),
			)
		);

		$markup = $this->devtools( null, $order_sanitizer )->render_panel();

		$this->assertStringContainsString(
			'data-devtools-course-slugs="' . self::expected_slugs_attr( array( 'gallery', 'video' ) ) . '"',
			$markup
		);
	}

	/**
	 * A user entry resolves to the real post's own slug (`post_name`), not
	 * its raw numeric id — the same identifier CourseRouter's own served page
	 * is reachable by.
	 */
	public function test_render_panel_resolves_a_user_entrys_slug_from_the_real_post(): void {
		$order_sanitizer = new CourseOrderSanitizer( new CourseCatalog( '/plugin/includes/Course/content' ), array( 'page', 'post' ) );
		Functions\when( 'get_option' )->justReturn(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);
		Functions\when( 'get_post_status' )->justReturn( 'publish' );
		Functions\when( 'get_post_type' )->justReturn( 'page' );
		Functions\when( 'is_post_publicly_viewable' )->justReturn( true );
		Functions\when( 'get_post_field' )->justReturn( 'my-custom-page' );

		$markup = $this->devtools( null, $order_sanitizer )->render_panel();

		$this->assertStringContainsString(
			'data-devtools-course-slugs="' . self::expected_slugs_attr( array( 'my-custom-page' ) ) . '"',
			$markup
		);
	}

	/**
	 * Mirrors the view's own escaping pipeline (`wp_json_encode()` then
	 * `esc_attr()`) so a test can assert the exact attribute value without
	 * duplicating that pipeline inline at every call site. Both functions
	 * behave like their real WordPress counterparts under this suite's
	 * `TestCase` (`wp_json_encode` aliased to `json_encode`, `esc_attr` to
	 * `htmlspecialchars` with `ENT_QUOTES`), so this reproduces exactly what
	 * the view itself emits.
	 *
	 * @param array<int, string> $slugs The ordered slugs to encode.
	 * @return string The expected `data-devtools-course-slugs` attribute value.
	 */
	private static function expected_slugs_attr( array $slugs ): string {
		return htmlspecialchars( (string) wp_json_encode( $slugs ), ENT_QUOTES );
	}
}
