<?php
/**
 * Tests for the move-course-page ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\MoveCoursePage;
use WP_Error;

/**
 * Behavioral tests for moving a page within the course.
 */
final class MoveCoursePageTest extends CourseTestCase {

	use AbilityContract;

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new MoveCoursePage( $this->editor() );
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
	public function test_it_is_named_move_course_page(): void {
		$this->assertSame( 'battery-surf-bench/move-course-page', $this->ability()->name() );
	}

	/**
	 * The new position is required.
	 */
	public function test_the_position_is_required(): void {
		$this->assertSame( array( 'position' ), $this->ability()->definition()['input_schema']['required'] );
	}

	/**
	 * A page moves to the end of the course.
	 */
	public function test_moves_a_page_to_the_end(): void {
		$result = $this->ability()->execute(
			array(
				'bundled_slug' => 'article-1',
				'position'     => 5,
			)
		);

		$this->assertSame( array( 'gallery', 'article-2', 'video', 'links', 'article-1' ), $this->saved_course() );
		$this->assertSame( 5, $result['moved']['position'] );
		$this->assertSame( 'article-1', $result['moved']['slug'] );
		$this->assertSame( 5, $result['page_count'] );
	}

	/**
	 * A page moves up to the front, and a site page moves like a bundled one.
	 */
	public function test_moves_a_site_page_to_the_front(): void {
		$this->add_post( 42, 'Contact' );
		$this->set_course(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'gallery',
				),
				array(
					'kind' => 'bundled',
					'slug' => 'links',
				),
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);

		$result = $this->ability()->execute(
			array(
				'post_id'  => 42,
				'position' => 1,
			)
		);

		$this->assertSame( array( '#42', 'gallery', 'links' ), $this->saved_course() );
		$this->assertSame( 'Contact', $result['moved']['title'] );
	}

	/**
	 * Moving a page to the position it already holds leaves the course as it was.
	 */
	public function test_moving_to_the_current_position_changes_nothing(): void {
		$result = $this->ability()->execute(
			array(
				'bundled_slug' => 'gallery',
				'position'     => 2,
			)
		);

		$this->assertTrue( $result['is_default'] );
	}

	/**
	 * A page that isn't in the course is a 404.
	 */
	public function test_refuses_a_page_that_is_not_in_the_course(): void {
		$this->set_course(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'gallery',
				),
			)
		);

		$result = $this->ability()->execute(
			array(
				'bundled_slug' => 'video',
				'position'     => 1,
			)
		);

		$this->assertError( $result, 'bsbench_page_not_in_course', 404 );
		$this->assertSame( '“Watch: Nineteen Seconds That Started It All” isn\'t in the course.', $result->get_error_message() );
	}

	/**
	 * A position past the last page is out of range.
	 */
	public function test_refuses_a_position_past_the_last_page(): void {
		$result = $this->ability()->execute(
			array(
				'bundled_slug' => 'gallery',
				'position'     => 6,
			)
		);

		$this->assertError( $result, 'bsbench_position_out_of_range', 400 );
		$this->assertSame( 'Position 6 is out of range: choose a position from 1 to 5.', $result->get_error_message() );
	}

	/**
	 * Naming no page, or both, is a 400.
	 */
	public function test_needs_exactly_one_page(): void {
		$this->assertError( $this->ability()->execute( array( 'position' => 1 ) ), 'bsbench_page_choice', 400 );
		$this->assertError(
			$this->ability()->execute(
				array(
					'post_id'      => 42,
					'bundled_slug' => 'video',
					'position'     => 1,
				)
			),
			'bsbench_page_choice',
			400
		);
	}
}
