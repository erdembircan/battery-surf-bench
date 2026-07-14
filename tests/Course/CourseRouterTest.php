<?php
/**
 * Tests for the course page front-end router.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Course\CourseRouter;
use ErdemBircan\BatterySurfBench\Course\Views\UserPageView;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\Support\FakeCapability;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use WP_Post;
use WP_Query;

use function has_action;
use function has_filter;

/**
 * The router serves the surfer's whole page sequence off a single opaque
 * index: on the main query, `?bsbSurfIndex=<n>&bsbNonce=<nonce>` resolves —
 * entirely server-side, wrapping via modulo — to the saved order's `n`-th
 * entry, turned into a single virtual page the theme renders. Its observable
 * contract is the posts it returns and the query flags it sets.
 *
 * The gate — capability AND a valid `bsb_surf` nonce — is checked BEFORE any
 * entry is resolved, so it guards every entry the index could name, bundled
 * or user alike: a request failing either check is left completely
 * untouched, whatever index it names.
 */
final class CourseRouterTest extends TestCase {

	private const INDEX_PARAM  = 'bsbSurfIndex';
	private const NONCE_PARAM  = 'bsbNonce';
	private const NONCE_ACTION = 'bsb_surf';
	private const BODY_CLASS   = 'bsb-course-page';
	private const OPTION       = 'bsb_course_order';

	/**
	 * Builds a router over the real catalog and a real sanitizer restricted to
	 * pages and posts, unless a sanitizer double is supplied for a scenario
	 * the real sanitizer can't otherwise be driven into.
	 *
	 * The capability is a fake test double rather than a mock of
	 * `current_user_can()`: injecting {@see FakeCapability} instead lets a
	 * test control whether the gate passes without touching any WordPress
	 * global.
	 *
	 * @param Assets|null               $assets    Asset service double, or a fresh mock when omitted.
	 * @param CourseOrderSanitizer|null $sanitizer Sanitizer to inject, or a real one restricted to pages/posts when omitted.
	 * @param bool                      $can       Whether the fake capability reports the requester authorized.
	 * @return CourseRouter The router under test.
	 */
	private function router( ?Assets $assets = null, ?CourseOrderSanitizer $sanitizer = null, bool $can = true ): CourseRouter {
		$catalog = new CourseCatalog( '/plugin/includes/Course/content' );

		return new CourseRouter(
			$catalog,
			self::INDEX_PARAM,
			self::NONCE_PARAM,
			self::NONCE_ACTION,
			new FakeCapability( $can ),
			$assets ?? Mockery::mock( Assets::class ),
			'build/style-course.css',
			'build/surfer.js',
			self::BODY_CLASS,
			self::OPTION,
			$sanitizer ?? new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) ),
			new UserPageView()
		);
	}

	/**
	 * Stages the index/nonce query vars and the nonce-verification outcome the
	 * router checks before resolving anything against the saved order. The
	 * capability half of the gate is controlled separately, by the fake
	 * injected through {@see router()}.
	 *
	 * @param string $index       The index value `get_query_var` reports, or '' to simulate the parameter being absent.
	 * @param bool   $nonce_valid Whether `wp_verify_nonce` reports the nonce valid.
	 */
	private function stage_request( string $index, bool $nonce_valid = true ): void {
		Functions\when( 'get_query_var' )->alias(
			static function ( string $query_var, $fallback = '' ) use ( $index ) {
				if ( self::INDEX_PARAM === $query_var ) {
					return $index;
				}
				if ( self::NONCE_PARAM === $query_var ) {
					return 'the-nonce';
				}
				return $fallback;
			}
		);
		Functions\when( 'wp_verify_nonce' )->justReturn( $nonce_valid ? 1 : false );
	}

	/**
	 * Stages the saved surf-course order `get_option` reports.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $order The saved order.
	 */
	private function stage_order( array $order ): void {
		Functions\when( 'get_option' )->justReturn( $order );
	}

	/**
	 * The default order — every bundled page, in catalog order — for tests
	 * that exercise a request resolving against a fresh install's starting
	 * sequence rather than a genuinely short or partial one.
	 *
	 * @return array<int, array{kind: string, slug: string}> The default order.
	 */
	private function default_order(): array {
		return ( new CourseOrderSanitizer( new CourseCatalog( '/plugin/includes/Course/content' ), array( 'page', 'post' ) ) )->default_order();
	}

	/**
	 * Stages the post lookups a `user` entry's resolution reads: both the
	 * sanitizer's eligibility check (when sanitizing the saved order on read)
	 * and the router's own content fetch.
	 *
	 * @param array<int, array{status?: string, type?: string, viewable?: bool, title?: string, content?: string}> $posts Post id => attributes.
	 */
	private function stage_user_pages( array $posts ): void {
		Functions\when( 'get_post_status' )->alias(
			static fn ( int $id ) => $posts[ $id ]['status'] ?? false
		);
		Functions\when( 'get_post_type' )->alias(
			static fn ( int $id ) => $posts[ $id ]['type'] ?? false
		);
		Functions\when( 'is_post_publicly_viewable' )->alias(
			static fn ( int $id ) => $posts[ $id ]['viewable'] ?? false
		);
		Functions\when( 'get_the_title' )->alias(
			static fn ( int $id ) => $posts[ $id ]['title'] ?? ''
		);
		Functions\when( 'get_post' )->alias(
			static function ( int $id ) use ( $posts ) {
				if ( ! isset( $posts[ $id ] ) ) {
					return null;
				}

				return (object) array( 'post_content' => $posts[ $id ]['content'] ?? '' );
			}
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->router() );
	}

	/**
	 * The router declares both query parameters and intercepts the main
	 * query's posts.
	 */
	public function test_register_hooks_query_vars_and_the_posts(): void {
		$router = $this->router();
		$router->register();

		$this->assertNotFalse( has_filter( 'query_vars', array( $router, 'add_query_vars' ) ) );
		$this->assertNotFalse( has_filter( 'the_posts', array( $router, 'maybe_render' ) ) );
	}

	/**
	 * Both the index and nonce parameters are added to the public query vars
	 * so WordPress parses them off the URL.
	 */
	public function test_add_query_vars_registers_the_index_and_nonce_params(): void {
		$this->assertSame(
			array( self::INDEX_PARAM, self::NONCE_PARAM ),
			$this->router()->add_query_vars( array() )
		);
	}

	/**
	 * A valid, authorized index request resolves to the saved order's entry
	 * at that position: index 0 against the default order (a fresh install's
	 * starting sequence) resolves to the first bundled catalog page.
	 */
	public function test_serves_the_bundled_entry_named_by_a_valid_authorized_index(): void {
		$this->stage_request( '0' );
		$this->stage_order( $this->default_order() );
		$query = new WP_Query();

		$posts = $this->router()->maybe_render( array(), $query );

		$this->assertCount( 1, $posts );
		$this->assertInstanceOf( WP_Post::class, $posts[0] );
		$this->assertSame( 'article-1', $posts[0]->post_name );
		$this->assertStringContainsString( '<!-- wp:', $posts[0]->post_content );
		$this->assertTrue( $query->is_singular );
		$this->assertTrue( $query->is_page );
	}

	/**
	 * A valid, authorized index request resolving to a user entry serves the
	 * real post's own content, with its title prefixed as a heading — unlike
	 * a bundled page, a real page's title is a field separate from its raw
	 * content.
	 */
	public function test_serves_a_user_entry_named_by_a_valid_authorized_index(): void {
		$this->stage_request( '0' );
		$this->stage_order(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);
		$this->stage_user_pages(
			array(
				42 => array(
					'status'   => 'publish',
					'type'     => 'page',
					'viewable' => true,
					'title'    => 'My Custom Page',
					'content'  => '<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->',
				),
			)
		);
		$query = new WP_Query();

		$posts = $this->router()->maybe_render( array(), $query );

		$this->assertCount( 1, $posts );
		$this->assertInstanceOf( WP_Post::class, $posts[0] );
		$this->assertSame( 'My Custom Page', $posts[0]->post_title );
		$this->assertStringContainsString( '<h1 class="wp-block-heading">My Custom Page</h1>', $posts[0]->post_content );
		$this->assertStringContainsString(
			'<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->',
			$posts[0]->post_content
		);
		$this->assertTrue( $query->is_singular );
		$this->assertTrue( $query->is_page );
	}

	/**
	 * A bundled catalog page's own editorial markup already carries whatever
	 * headline it needs, so the router never prefixes a title heading onto it
	 * — only a user entry's raw content, which has no heading of its own,
	 * gets one.
	 */
	public function test_serves_a_bundled_entry_without_a_title_heading(): void {
		$this->stage_request( '0' );
		$this->stage_order( $this->default_order() );

		$posts = $this->router()->maybe_render( array(), new WP_Query() );

		$this->assertCount( 1, $posts );
		$this->assertInstanceOf( WP_Post::class, $posts[0] );
		$this->assertStringNotContainsString( '<h1 class="wp-block-heading">', $posts[0]->post_content );
	}

	/**
	 * The index wraps via modulo against the saved order's length, so the
	 * client's ever-incrementing counter never needs to know how many pages
	 * exist: index 5 against the 5-entry default order resolves back to
	 * entry 0.
	 */
	public function test_wraps_the_index_via_modulo(): void {
		$this->stage_request( '5' );
		$this->stage_order( $this->default_order() );

		$posts = $this->router()->maybe_render( array(), new WP_Query() );

		$this->assertSame( 'article-1', $posts[0]->post_name );
	}

	/**
	 * A request naming no index at all (the parameter is absent) leaves the
	 * query completely untouched — nothing about the gate is even reached.
	 */
	public function test_leaves_the_query_untouched_when_no_index_is_requested(): void {
		Functions\when( 'get_query_var' )->justReturn( '' );
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * Security regression coverage for the reinforced requirement: the
	 * capability + nonce gate guards the ENTIRE index route — every entry it
	 * could resolve to, bundled or user alike — not just user entries. An
	 * index that would resolve to a perfectly ordinary BUNDLED page must
	 * still be refused when the nonce is missing/invalid, exactly like a
	 * user entry would be.
	 */
	public function test_leaves_a_bundled_index_untouched_with_a_missing_or_invalid_nonce(): void {
		$this->stage_request( '0', false );
		$this->stage_order( array() );
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * The same reinforced requirement, for a caller lacking the capability:
	 * a bundled index is refused exactly like a user entry would be — the
	 * gate is checked before any entry, bundled or user, is even resolved.
	 */
	public function test_leaves_a_bundled_index_untouched_without_the_capability(): void {
		$this->stage_request( '0' );
		$this->stage_order( array() );
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router( null, null, false )->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * A user-resolving index is refused with a missing/invalid nonce, the
	 * same as a bundled index — the exact exploit the index-based redesign
	 * closes: nothing about the request other than the gate decides what is
	 * served.
	 */
	public function test_leaves_a_user_index_untouched_with_an_invalid_nonce(): void {
		$this->stage_request( '0', false );
		$this->stage_order(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * A user-resolving index is refused for a caller lacking the capability,
	 * mirroring the bundled case.
	 */
	public function test_leaves_a_user_index_untouched_without_the_capability(): void {
		$this->stage_request( '0' );
		$this->stage_order(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router( null, null, false )->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * A user entry that is saved and eligible (so the sanitizer keeps it when
	 * sanitizing the order) but whose post has since vanished between that
	 * check and the router's own fetch is left unresolved rather than
	 * fatally erroring.
	 */
	public function test_leaves_the_query_untouched_when_a_resolved_user_post_vanishes(): void {
		$this->stage_request( '0' );
		$this->stage_order(
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
		Functions\when( 'get_post' )->justReturn( null );
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * An empty saved order — every page, bundled and user alike, removed from
	 * the settings screen — is a genuinely reachable state now that bundled
	 * pages are removable and no longer force-reinserted, and resolves to
	 * nothing rather than dividing by zero.
	 */
	public function test_leaves_the_query_untouched_for_an_empty_saved_order(): void {
		$this->stage_request( '0' );
		$this->stage_order( array() );
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * A saved order shorter than the full bundled set — some bundled pages
	 * removed, leaving just a couple of entries — still resolves correctly:
	 * the index wraps via modulo against whatever length the saved order
	 * actually is, not a length of (at least) 5.
	 */
	public function test_wraps_the_index_via_modulo_for_a_saved_order_shorter_than_the_bundled_set(): void {
		$this->stage_request( '3' );
		$this->stage_order(
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

		$posts = $this->router()->maybe_render( array(), new WP_Query() );

		// count = 2, so index 3 % 2 = 1 → the second entry, 'video'.
		$this->assertSame( 'video', $posts[0]->post_name );
	}

	/**
	 * The saved order is read with the sanitizer's `default_order()` as the
	 * `get_option` default, so a fresh install (the option never saved) still
	 * surfs the full bundled set — the healing-on-every-read behaviour this
	 * class no longer has moved entirely onto seeding a fresh install, not
	 * patching a saved one.
	 */
	public function test_resolves_against_the_sanitizers_default_order_when_no_option_is_saved(): void {
		$this->stage_request( '0' );

		Functions\expect( 'get_option' )
			->once()
			->with( self::OPTION, $this->default_order() )
			->andReturn( $this->default_order() );

		$posts = $this->router()->maybe_render( array(), new WP_Query() );

		$this->assertSame( 'article-1', $posts[0]->post_name );
	}

	/**
	 * Secondary queries are never intercepted, even on an index request, so
	 * widgets and menus on the page keep their own results.
	 */
	public function test_leaves_secondary_queries_untouched(): void {
		$query          = new WP_Query();
		$query->is_main = false;
		$original       = array( 'sidebar' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, $query ) );
	}

	/**
	 * Serving a page hooks both the stylesheet and the surf engine script to
	 * `wp_enqueue_scripts`, so a course page loads its markup styling and its
	 * behavioral engine.
	 */
	public function test_serving_a_page_hooks_the_style_and_script_enqueue(): void {
		$this->stage_request( '0' );
		$this->stage_order( $this->default_order() );
		$router = $this->router();

		$router->maybe_render( array(), new WP_Query() );

		$this->assertNotFalse( has_action( 'wp_enqueue_scripts', array( $router, 'enqueue_style' ) ) );
		$this->assertNotFalse( has_action( 'wp_enqueue_scripts', array( $router, 'enqueue_script' ) ) );
	}

	/**
	 * Serving a page also hooks the body-class marker onto `body_class`, so the
	 * viewport load guard can recognize a served course page from inside the
	 * iframe: a 404 or any other non-course page never hooks it.
	 */
	public function test_serving_a_page_hooks_the_body_class_marker(): void {
		$this->stage_request( '0' );
		$this->stage_order( $this->default_order() );
		$router = $this->router();

		$router->maybe_render( array(), new WP_Query() );

		$this->assertNotFalse( has_filter( 'body_class', array( $router, 'mark_course_body' ) ) );
	}

	/**
	 * The body-class marker appends the course-page marker to whatever classes
	 * WordPress already assembled, rather than replacing them.
	 */
	public function test_mark_course_body_appends_the_course_page_marker(): void {
		$classes = $this->router()->mark_course_body( array( 'existing-class' ) );

		$this->assertSame( array( 'existing-class', self::BODY_CLASS ), $classes );
	}

	/**
	 * The style hook enqueues the course stylesheet through the asset service.
	 */
	public function test_enqueue_style_enqueues_the_course_stylesheet(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'enqueue' )->once()->with( 'build/style-course.css' );

		$this->router( $assets )->enqueue_style();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * The script hook enqueues the surf engine bundle through the asset service.
	 */
	public function test_enqueue_script_enqueues_the_surf_engine(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'enqueue' )->once()->with( 'build/surfer.js' );

		$this->router( $assets )->enqueue_script();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}
}
