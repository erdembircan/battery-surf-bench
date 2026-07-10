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
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use WP_Post;
use WP_Query;

use function has_action;
use function has_filter;

/**
 * The router serves course pages off a URL parameter without seeding anything:
 * on the main query, a parameter naming a catalog page — or a `user-<id>`
 * slug that is currently selected and eligible in the saved surf-course order
 * — is turned into a single virtual page flagged singular, which the theme
 * then renders. Its observable contract is the posts it returns and the query
 * flags it sets; every other request, including a `user-<id>` slug that is
 * NOT in the saved order, is left untouched.
 */
final class CourseRouterTest extends TestCase {

	private const PARAM      = 'bsbSessionPage';
	private const BODY_CLASS = 'bsb-course-page';
	private const OPTION     = 'bsb_course_order';

	/**
	 * Builds a router over the real catalog and a real sanitizer restricted to
	 * pages and posts.
	 *
	 * @param Assets|null $assets Asset service double, or a fresh mock when omitted.
	 * @return CourseRouter The router under test.
	 */
	private function router( ?Assets $assets = null ): CourseRouter {
		$catalog   = new CourseCatalog( '/plugin/includes/Course/content' );
		$sanitizer = new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) );

		return new CourseRouter(
			$catalog,
			self::PARAM,
			$assets ?? Mockery::mock( Assets::class ),
			'build/style-course.css',
			'build/surfer.js',
			self::BODY_CLASS,
			self::OPTION,
			$sanitizer
		);
	}

	/**
	 * Stages the slug the router reads from the request.
	 *
	 * @param string $slug Slug `get_query_var` should report.
	 */
	private function stage_slug( string $slug ): void {
		Functions\when( 'get_query_var' )->justReturn( $slug );
		Functions\when( 'sanitize_key' )->returnArg();
	}

	/**
	 * Stages the saved surf-course order and the post lookups a `user-<id>`
	 * resolution reads, so a given post id resolves as eligible.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}>                                             $order Saved surf-course order.
	 * @param array<int, array{status?: string, type?: string, viewable?: bool, title?: string, content?: string}> $posts Post id => attributes.
	 */
	private function stage_user_pages( array $order, array $posts ): void {
		Functions\when( 'get_option' )->justReturn( $order );
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
	 * The router declares the course query var and intercepts the main query's
	 * posts.
	 */
	public function test_register_hooks_query_var_and_the_posts(): void {
		$router = $this->router();
		$router->register();

		$this->assertNotFalse( has_filter( 'query_vars', array( $router, 'add_query_var' ) ) );
		$this->assertNotFalse( has_filter( 'the_posts', array( $router, 'maybe_render' ) ) );
	}

	/**
	 * The course parameter is added to the public query vars so WordPress parses
	 * it off the URL.
	 */
	public function test_add_query_var_registers_the_course_param(): void {
		$this->assertSame( array( self::PARAM ), $this->router()->add_query_var( array() ) );
	}

	/**
	 * When the parameter names a catalog page on the main query, the router
	 * returns a single virtual page carrying that page's markup and flags the
	 * query as a singular page so the theme renders it.
	 */
	public function test_serves_a_virtual_page_for_a_known_slug(): void {
		$this->stage_slug( 'article-1' );
		$query = new WP_Query();

		$posts = $this->router()->maybe_render( array(), $query );

		$this->assertCount( 1, $posts );
		$this->assertInstanceOf( WP_Post::class, $posts[0] );
		$this->assertStringContainsString( '<!-- wp:', $posts[0]->post_content );
		$this->assertTrue( $query->is_singular );
		$this->assertTrue( $query->is_page );
	}

	/**
	 * A parameter that names no catalog page leaves the query's posts untouched.
	 */
	public function test_leaves_unknown_slugs_untouched(): void {
		$this->stage_slug( 'not-a-page' );
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * A `user-<id>` slug whose id is currently selected and eligible in the
	 * saved surf-course order is served exactly like a bundled page: a virtual
	 * page carrying the real post's own content, flagged singular.
	 */
	public function test_serves_a_virtual_page_for_a_selected_eligible_user_page(): void {
		$this->stage_slug( 'user-42' );
		$this->stage_user_pages(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
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
		$this->assertSame(
			'<!-- wp:paragraph --><p>Hello</p><!-- /wp:paragraph -->',
			$posts[0]->post_content
		);
		$this->assertTrue( $query->is_singular );
		$this->assertTrue( $query->is_page );
	}

	/**
	 * A `user-<id>` slug whose id is NOT in the saved surf-course order's user
	 * set is left completely untouched — the authoritative, server-side gate.
	 * This is the exact exploit the fix closes: the id must be currently
	 * selected in the saved admin option, never decided by the request.
	 */
	public function test_leaves_a_non_selected_user_slug_untouched(): void {
		$this->stage_slug( 'user-99' );
		$this->stage_user_pages(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			array(
				99 => array(
					'status'   => 'publish',
					'type'     => 'page',
					'viewable' => true,
					'title'    => 'Not Selected',
					'content'  => '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->',
				),
			)
		);
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * A `user-<id>` slug whose id is saved but no longer resolves to an
	 * eligible post (trashed, unpublished, or otherwise dropped by the
	 * sanitizer) is left untouched too — the saved order is healed/validated
	 * on every read, so a stale saved id never gets served.
	 */
	public function test_leaves_an_ineligible_user_slug_untouched(): void {
		$this->stage_slug( 'user-42' );
		$this->stage_user_pages(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			array( 42 => array( 'status' => 'trash' ) )
		);
		$original = array( 'untouched' );

		$this->assertSame( $original, $this->router()->maybe_render( $original, new WP_Query() ) );
	}

	/**
	 * A slug shaped like a real page's own permalink slug (not the
	 * `user-<id>` router form) never resolves as a user page, regardless of
	 * the saved order — the router only ever serves its own synthetic slug
	 * shape, never a real permalink. No enqueue is ever hooked for such a
	 * request.
	 */
	public function test_never_serves_or_enqueues_for_a_real_permalink_slug(): void {
		$this->stage_slug( 'my-real-page' );
		$this->stage_user_pages(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
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
		$router   = $this->router();
		$original = array( 'untouched' );

		$this->assertSame( $original, $router->maybe_render( $original, new WP_Query() ) );
		$this->assertFalse( has_action( 'wp_enqueue_scripts', array( $router, 'enqueue_script' ) ) );
		$this->assertFalse( has_filter( 'body_class', array( $router, 'mark_course_body' ) ) );
	}

	/**
	 * Secondary queries are never intercepted, even on a course-page request, so
	 * widgets and menus on the page keep their own results.
	 */
	public function test_leaves_secondary_queries_untouched(): void {
		$this->stage_slug( 'article-1' );
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
		$this->stage_slug( 'article-1' );
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
		$this->stage_slug( 'article-1' );
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
