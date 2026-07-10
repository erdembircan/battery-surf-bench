<?php
/**
 * Tests for the user-page surf engine.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Course\UserPageEngine;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;
use function has_filter;

/**
 * The engine is the counterpart to `CourseRouter` for real, user-selected
 * pages: it must enqueue the surf engine and stamp the shared course-page
 * body-class marker on exactly one kind of request — a genuine surfer iframe
 * visit to a saved user page — and touch nothing at all otherwise, including
 * a normal human visit to the very same page.
 */
final class UserPageEngineTest extends TestCase {

	private const OPTION       = 'bsb_course_order';
	private const SCRIPT       = 'build/surfer.js';
	private const TRAITS_PARAM = 'bsbTraits';
	private const BODY_CLASS   = 'bsb-course-page';

	/**
	 * Builds an engine over a real sanitizer restricted to pages and posts,
	 * with the given asset service double.
	 *
	 * @param Assets|null $assets Asset service double, or a fresh mock when omitted.
	 * @return UserPageEngine The engine under test.
	 */
	private function engine( ?Assets $assets = null ): UserPageEngine {
		$sanitizer = new CourseOrderSanitizer( new CourseCatalog( '/plugin/includes/Course/content' ), array( 'page', 'post' ) );

		return new UserPageEngine(
			self::OPTION,
			$sanitizer,
			$assets ?? Mockery::mock( Assets::class ),
			self::SCRIPT,
			self::TRAITS_PARAM,
			self::BODY_CLASS
		);
	}

	/**
	 * Stages the saved order and the singular/queried-post/traits-param
	 * conditions the engine gates on.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $order    Saved surf-course order.
	 * @param bool                                                     $singular Whether the current request is a singular view.
	 * @param int                                                      $post_id  The queried object id.
	 * @param string|null                                              $traits   Value `get_query_var` reports for the traits param, or null when absent.
	 */
	private function stage(
		array $order,
		bool $singular,
		int $post_id,
		?string $traits
	): void {
		Functions\when( 'get_option' )->justReturn( $order );
		Functions\when( 'get_post_status' )->justReturn( 'publish' );
		Functions\when( 'get_post_type' )->justReturn( 'page' );
		Functions\when( 'is_post_publicly_viewable' )->justReturn( true );
		Functions\when( 'is_singular' )->justReturn( $singular );
		Functions\when( 'get_queried_object_id' )->justReturn( $post_id );
		Functions\when( 'get_query_var' )->justReturn( $traits ?? '' );
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->engine() );
	}

	/**
	 * Registration hooks the traits query var, the script enqueue and the
	 * body-class marker.
	 */
	public function test_register_hooks_query_var_enqueue_and_body_class(): void {
		$engine = $this->engine();
		$engine->register();

		$this->assertNotFalse( has_filter( 'query_vars', array( $engine, 'add_query_var' ) ) );
		$this->assertNotFalse( has_action( 'wp_enqueue_scripts', array( $engine, 'enqueue' ) ) );
		$this->assertNotFalse( has_filter( 'body_class', array( $engine, 'mark_body' ) ) );
	}

	/**
	 * The traits parameter is added to the public query vars so
	 * `get_query_var()` can read its presence without touching the request
	 * superglobal.
	 */
	public function test_add_query_var_registers_the_traits_param(): void {
		$this->assertSame( array( self::TRAITS_PARAM ), $this->engine()->add_query_var( array() ) );
	}

	/**
	 * A genuine surfer visit — singular, the queried post is a saved user
	 * page, and the traits param is present — enqueues the surf engine script.
	 */
	public function test_enqueue_loads_the_surf_engine_for_a_surfed_user_page(): void {
		$this->stage(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			true,
			42,
			'10,0,0,0,0'
		);

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'enqueue' )->once()->with( self::SCRIPT );

		$this->engine( $assets )->enqueue();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * A human opening their own saved page directly — same post, same
	 * singular view, but no traits param — enqueues nothing at all. This is
	 * the gate the traits param exists for.
	 */
	public function test_enqueue_does_nothing_for_a_normal_human_visit(): void {
		$this->stage(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			true,
			42,
			null
		);

		$assets = Mockery::mock( Assets::class );
		$assets->shouldNotReceive( 'enqueue' );

		$this->engine( $assets )->enqueue();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * A surfer visit to a post that was never saved to the sequence enqueues
	 * nothing, even though the traits param is present.
	 */
	public function test_enqueue_does_nothing_for_a_non_selected_post(): void {
		$this->stage(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			true,
			99,
			'10,0,0,0,0'
		);

		$assets = Mockery::mock( Assets::class );
		$assets->shouldNotReceive( 'enqueue' );

		$this->engine( $assets )->enqueue();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * A surfer-trait request against the right post id, but not a singular
	 * view (e.g. an archive query happens to share the id numerically),
	 * enqueues nothing.
	 */
	public function test_enqueue_does_nothing_when_not_singular(): void {
		$this->stage(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			false,
			42,
			'10,0,0,0,0'
		);

		$assets = Mockery::mock( Assets::class );
		$assets->shouldNotReceive( 'enqueue' );

		$this->engine( $assets )->enqueue();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The body-class marker is appended, preserving existing classes, only for
	 * a genuine surfer visit to a saved user page.
	 */
	public function test_mark_body_appends_the_marker_for_a_surfed_user_page(): void {
		$this->stage(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			true,
			42,
			'10,0,0,0,0'
		);

		$classes = $this->engine()->mark_body( array( 'existing-class' ) );

		$this->assertSame( array( 'existing-class', self::BODY_CLASS ), $classes );
	}

	/**
	 * The body-class marker is left off for a normal human visit to the same
	 * saved page — no traits param, no marker.
	 */
	public function test_mark_body_leaves_classes_untouched_for_a_normal_visit(): void {
		$this->stage(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			true,
			42,
			null
		);

		$classes = $this->engine()->mark_body( array( 'existing-class' ) );

		$this->assertSame( array( 'existing-class' ), $classes );
	}
}
