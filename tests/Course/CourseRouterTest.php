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
 * on the main query, a parameter naming a catalog page is turned into a single
 * virtual page flagged singular, which the theme then renders. Its observable
 * contract is the posts it returns and the query flags it sets; every other
 * request is left untouched.
 */
final class CourseRouterTest extends TestCase {

	private const PARAM = 'bsbSessionPage';

	/**
	 * Builds a router over the real catalog.
	 *
	 * @param Assets|null $assets Asset service double, or a fresh mock when omitted.
	 * @return CourseRouter The router under test.
	 */
	private function router( ?Assets $assets = null ): CourseRouter {
		$catalog = new CourseCatalog( '/plugin/includes/Course/content' );

		return new CourseRouter( $catalog, self::PARAM, $assets ?? Mockery::mock( Assets::class ), 'build/style-course.css', 'build/surfer.js' );
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

		$this->assertSame( array( 'existing-class', 'bsb-course-page' ), $classes );
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
