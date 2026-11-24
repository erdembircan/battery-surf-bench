<?php
/**
 * Tests for the remove-course-page ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\RemoveCoursePage;
use WP_Error;

/**
 * Behavioral tests for removing a page from the course.
 */
final class RemoveCoursePageTest extends CourseTestCase {

	use AbilityContract;

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new RemoveCoursePage( $this->editor() );
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
	public function test_it_is_named_remove_course_page(): void {
		$this->assertSame( 'battery-surf-bench/remove-course-page', $this->ability()->name() );
	}

	/**
	 * A page leaves the course, and is returned as it was, with the position it held.
	 */
	public function test_removes_a_page_and_returns_it_as_it_was(): void {
		$result = $this->ability()->execute( array( 'bundled_slug' => 'article-2' ) );

		$this->assertSame( array( 'article-1', 'gallery', 'video', 'links' ), $this->saved_course() );
		$this->assertSame( 4, $result['page_count'] );
		$this->assertSame( 3, $result['removed']['position'] );
		$this->assertSame( 'article-2', $result['removed']['slug'] );
		$this->assertFalse( $result['is_default'] );
	}

	/**
	 * A site page leaves the course by its post id, and stays on the site.
	 */
	public function test_removes_a_site_page(): void {
		$this->add_post( 42, 'Contact' );
		$this->set_course(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'gallery',
				),
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);

		$result = $this->ability()->execute( array( 'post_id' => 42 ) );

		$this->assertSame( array( 'gallery' ), $this->saved_course() );
		$this->assertSame( 'Contact', $result['removed']['title'] );
		$this->assertArrayHasKey( 42, $this->posts );
	}

	/**
	 * A page that isn't in the course is a 404.
	 */
	public function test_refuses_a_page_that_is_not_in_the_course(): void {
		$result = $this->ability()->execute( array( 'post_id' => 777 ) );

		$this->assertError( $result, 'bsbench_page_not_in_course', 404 );
		$this->assertSame( '“777” isn\'t in the course.', $result->get_error_message() );
	}

	/**
	 * The course keeps at least one page: its only page can't be removed.
	 */
	public function test_refuses_to_remove_the_last_page(): void {
		$this->set_course(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'links',
				),
			)
		);

		$result = $this->ability()->execute( array( 'bundled_slug' => 'links' ) );

		$this->assertError( $result, 'bsbench_last_page', 409 );
		$this->assertSame( 'The course needs at least one page, so its only page can\'t be removed.', $result->get_error_message() );
		$this->assertSame( array( 'links' ), $this->saved_course() );
	}

	/**
	 * Naming no page, or both, is a 400.
	 */
	public function test_needs_exactly_one_page(): void {
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
}
