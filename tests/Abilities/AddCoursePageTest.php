<?php
/**
 * Tests for the add-course-page ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\AddCoursePage;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use WP_Error;

/**
 * Behavioral tests for adding a page to the course: which pages are accepted,
 * where they land, and each reason one is refused.
 */
final class AddCoursePageTest extends CourseTestCase {

	use AbilityContract;

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new AddCoursePage( $this->editor() );
	}

	/**
	 * The annotations of an ability that changes the course without destroying it.
	 *
	 * @return array<string, bool> The annotations.
	 */
	protected function expected_annotations(): array {
		return Annotations::write();
	}

	/**
	 * Asserts a result is an error with the given code and HTTP status.
	 *
	 * @param mixed  $result The result.
	 * @param string $code   The expected error code.
	 * @param int    $status The expected HTTP status.
	 */
	private function assertError( $result, string $code, int $status ): void {
		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( $code, $result->get_error_code() );
		$this->assertSame( array( 'status' => $status ), $result->get_error_data() );
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_add_course_page(): void {
		$this->assertSame( 'battery-surf-bench/add-course-page', $this->ability()->name() );
	}

	/**
	 * The input names a site page or a bundled page, and a position.
	 */
	public function test_input_names_a_page_and_a_position(): void {
		$properties = $this->ability()->definition()['input_schema']['properties'];

		$this->assertSame( array( 'post_id', 'bundled_slug', 'position' ), array_keys( $properties ) );
		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ), $properties['bundled_slug']['enum'] );
		$this->assertSame( 1, $properties['position']['minimum'] );
	}

	/**
	 * With no position the page goes at the end.
	 */
	public function test_appends_a_published_page_by_default(): void {
		$this->add_post( 42, 'About' );

		$result = $this->ability()->execute( array( 'post_id' => 42 ) );

		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links', '#42' ), $this->saved_course() );
		$this->assertSame( 6, $result['page_count'] );
		$this->assertFalse( $result['is_default'] );
		$this->assertSame( 6, $result['added']['position'] );
		$this->assertSame( 'About', $result['added']['title'] );
		$this->assertSame( 42, $result['added']['post_id'] );
	}

	/**
	 * A position puts the page there, and the pages after it move down.
	 */
	public function test_inserts_at_the_requested_position(): void {
		$this->add_post( 42, 'About' );

		$result = $this->ability()->execute(
			array(
				'post_id'  => 42,
				'position' => 1,
			)
		);

		$this->assertSame( array( '#42', 'article-1', 'gallery', 'article-2', 'video', 'links' ), $this->saved_course() );
		$this->assertSame( 1, $result['added']['position'] );
		$this->assertSame( 1, $result['pages'][0]['position'] );
		$this->assertSame( 42, $result['pages'][0]['post_id'] );
	}

	/**
	 * A bundled page that was removed can be added back by its slug.
	 */
	public function test_adds_a_bundled_page_by_slug(): void {
		$this->set_course(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'article-1',
				),
			)
		);

		$result = $this->ability()->execute(
			array(
				'bundled_slug' => 'video',
				'position'     => 1,
			)
		);

		$this->assertSame( array( 'video', 'article-1' ), $this->saved_course() );
		$this->assertSame( 'bundled', $result['added']['kind'] );
		$this->assertSame( 'video', $result['added']['slug'] );
		$this->assertSame( 'Watch: Nineteen Seconds That Started It All', $result['added']['title'] );
	}

	/**
	 * A draft is refused, and the course is left as it was.
	 */
	public function test_refuses_a_draft(): void {
		$this->add_post( 43, 'Pricing', 'draft' );

		$result = $this->ability()->execute( array( 'post_id' => 43 ) );

		$this->assertError( $result, 'bsbench_page_not_published', 400 );
		$this->assertArrayNotHasKey( 'bsbench_course_order', $this->options );
	}

	/**
	 * A private page is refused for being private, under its plain title.
	 */
	public function test_refuses_a_private_page(): void {
		$this->add_post( 44, 'Team Notes', 'private', 'page', false );

		$result = $this->ability()->execute( array( 'post_id' => 44 ) );

		$this->assertError( $result, 'bsbench_page_private', 400 );
		$this->assertSame(
			'“Team Notes” can\'t be in the course because it\'s private. Only published, public posts and pages can be in the course.',
			$result->get_error_message()
		);
	}

	/**
	 * A post that doesn't exist is a 404.
	 */
	public function test_refuses_a_post_that_does_not_exist(): void {
		$this->assertError( $this->ability()->execute( array( 'post_id' => 404 ) ), 'bsbench_page_not_found', 404 );
	}

	/**
	 * A page already in the course is a 409.
	 */
	public function test_refuses_a_page_already_in_the_course(): void {
		$this->add_post( 42, 'About' );
		$this->ability()->execute( array( 'post_id' => 42 ) );

		$result = $this->ability()->execute( array( 'post_id' => 42 ) );

		$this->assertError( $result, 'bsbench_page_in_course', 409 );
		$this->assertSame( '“About” is already in the course, at position 6.', $result->get_error_message() );
	}

	/**
	 * A bundled page already in the course is a 409 too.
	 */
	public function test_refuses_a_bundled_page_already_in_the_course(): void {
		$this->assertError( $this->ability()->execute( array( 'bundled_slug' => 'gallery' ) ), 'bsbench_page_in_course', 409 );
	}

	/**
	 * A position past the end of the course, plus one, is out of range.
	 */
	public function test_refuses_a_position_past_the_end(): void {
		$this->add_post( 42, 'About' );

		$result = $this->ability()->execute(
			array(
				'post_id'  => 42,
				'position' => 8,
			)
		);

		$this->assertError( $result, 'bsbench_position_out_of_range', 400 );
		$this->assertSame( 'Position 8 is out of range: choose a position from 1 to 6.', $result->get_error_message() );
	}

	/**
	 * The position just past the last page is the end, and is allowed.
	 */
	public function test_accepts_the_position_just_past_the_last_page(): void {
		$this->add_post( 42, 'About' );

		$result = $this->ability()->execute(
			array(
				'post_id'  => 42,
				'position' => 6,
			)
		);

		$this->assertSame( 6, $result['added']['position'] );
	}

	/**
	 * Naming no page, or both, is a 400.
	 */
	public function test_needs_exactly_one_page(): void {
		$this->add_post( 42, 'About' );

		$this->assertError( $this->ability()->execute( array() ), 'bsbench_page_choice', 400 );
		$this->assertError(
			$this->ability()->execute(
				array(
					'post_id'      => 42,
					'bundled_slug' => 'video',
				)
			),
			'bsbench_page_choice',
			400
		);
	}

	/**
	 * When the saved course doesn't hold the page where it was put, that is a
	 * 500, not a success.
	 */
	public function test_reports_a_course_that_was_not_saved(): void {
		$this->assertError( $this->ability()->execute( array( 'bundled_slug' => 'not-a-bundled-page' ) ), 'bsbench_course_not_saved', 500 );
	}
}
