<?php
/**
 * Tests for the reset-course ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\ResetCourse;

/**
 * Behavioral tests for resetting the course to the default.
 */
final class ResetCourseTest extends CourseTestCase {

	use AbilityContract;

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new ResetCourse( $this->editor() );
	}

	/**
	 * The annotations of an ability that destroys and is safe to repeat.
	 *
	 * @return array<string, bool> The annotations.
	 */
	protected function expected_annotations(): array {
		return Annotations::reset();
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_reset_course(): void {
		$this->assertSame( 'battery-surf-bench/reset-course', $this->ability()->name() );
	}

	/**
	 * Core runs a destructive, idempotent ability over DELETE.
	 */
	public function test_it_is_destructive_and_idempotent_so_it_runs_over_delete(): void {
		$annotations = $this->ability()->definition()['annotations'];

		$this->assertTrue( $annotations['destructive'] );
		$this->assertTrue( $annotations['idempotent'] );
	}

	/**
	 * A customized course is replaced with the bundled pages in their original
	 * order, and site pages leave it.
	 */
	public function test_saves_the_default_course(): void {
		$this->add_post( 42, 'Contact' );
		$this->set_course(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
				array(
					'kind' => 'bundled',
					'slug' => 'links',
				),
			)
		);

		$result = $this->ability()->execute( array() );

		$this->assertTrue( $result['is_default'] );
		$this->assertSame( 5, $result['page_count'] );
		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ), $this->saved_course() );
	}

	/**
	 * Resetting a course that is already the default changes nothing more.
	 */
	public function test_resetting_twice_leaves_the_same_course(): void {
		$first  = $this->ability()->execute( array() );
		$second = $this->ability()->execute( array() );

		$this->assertSame( $first, $second );
	}
}
