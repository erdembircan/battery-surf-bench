<?php
/**
 * Tests for the get-course ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\GetCourse;

/**
 * Behavioral tests for reading the course.
 */
final class GetCourseTest extends CourseTestCase {

	use AbilityContract;

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new GetCourse( $this->editor() );
	}

	/**
	 * The annotations of an ability that only reads.
	 *
	 * @return array<string, bool> The annotations.
	 */
	protected function expected_annotations(): array {
		return Annotations::read();
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_get_course(): void {
		$this->assertSame( 'battery-surf-bench/get-course', $this->ability()->name() );
	}

	/**
	 * It takes no input.
	 */
	public function test_it_takes_no_input(): void {
		$this->assertSame( array(), $this->ability()->definition()['input_schema']['properties'] );
	}

	/**
	 * A site that never saved a course has the default one.
	 */
	public function test_returns_the_default_course_when_none_was_saved(): void {
		$result = $this->ability()->execute( array() );

		$this->assertSame( 5, $result['page_count'] );
		$this->assertTrue( $result['is_default'] );
		$this->assertSame( array( 1, 2, 3, 4, 5 ), array_column( $result['pages'], 'position' ) );
		$this->assertSame( 'The Hidden Cost of a Browser Tab', $result['pages'][0]['title'] );
	}

	/**
	 * A saved course lists its pages in visit order, bundled and site pages
	 * together, and says which bundled pages it leaves out.
	 */
	public function test_returns_the_saved_course_in_visit_order(): void {
		$this->add_post( 42, 'Contact' );
		$this->set_course(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
				array(
					'kind' => 'bundled',
					'slug' => 'video',
				),
			)
		);

		$result = $this->ability()->execute( array() );

		$this->assertSame( 2, $result['page_count'] );
		$this->assertFalse( $result['is_default'] );
		$this->assertSame( array( 'user', 'bundled' ), array_column( $result['pages'], 'kind' ) );
		$this->assertSame( 'Contact', $result['pages'][0]['title'] );
		$this->assertSame( array( false, false, false, true, false ), array_column( $result['bundled_pages'], 'in_course' ) );
	}
}
