<?php
/**
 * Tests for the trash-runs and restore-runs abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\RestoreRuns;
use ErdemBircan\BatterySurfBench\Abilities\TrashRuns;

use function has_filter;

/**
 * Behavioral tests for moving runs to the trash and back: every id is checked
 * before any run is moved, runs return as published, and a failure is reported.
 */
final class TrashAndRestoreRunsTest extends AbilityTestCase {

	/** Every run is moved to the trash, and returned as it was before. */
	public function test_trashes_every_run_and_returns_them_as_they_were(): void {
		$runs = array( RunFixture::run( id: 4 ), RunFixture::run( id: 6 ) );

		Functions\expect( 'wp_trash_post' )->once()->with( 4 )->andReturn( (object) array() );
		Functions\expect( 'wp_trash_post' )->once()->with( 6 )->andReturn( (object) array() );

		$result = ( new TrashRuns( new FakeSessionReader( $runs ) ) )->execute( array( 'ids' => array( 4, 6 ) ) );

		$this->assertSame( 2, $result['trashed_count'] );
		$this->assertSame( $runs, $result['trashed'] );
	}

	/** On a site with no trash, WordPress would delete the runs for good, so nothing is moved. */
	public function test_trashes_nothing_on_a_site_that_keeps_no_trash(): void {
		Functions\expect( 'wp_trash_post' )->never();

		$trash = new class( new FakeSessionReader( array( RunFixture::run( id: 4 ) ) ) ) extends TrashRuns {

			/**
			 * Reports a site whose trash is switched off.
			 *
			 * @return bool Always false.
			 */
			protected function keeps_trash(): bool {
				return false;
			}
		};

		$this->assertError( $trash->execute( array( 'ids' => array( 4 ) ) ), 'bsbench_trash_disabled', 409, 'This site keeps no trash, so moving these runs to the trash would delete them for good. Nothing was moved.' );
	}

	/** When any id isn't a recorded run, nothing is trashed, and the error names them all. */
	public function test_trashes_nothing_when_any_id_is_unknown(): void {
		Functions\expect( 'wp_trash_post' )->never();

		$result = ( new TrashRuns( new FakeSessionReader( array( RunFixture::run( id: 4 ) ) ) ) )->execute( array( 'ids' => array( 4, 8, 9 ) ) );

		$this->assertError( $result, 'bsbench_trash_not_found', 404, "These ids aren't recorded benchmark runs: 8, 9. Nothing was moved to the trash." );
	}

	/** A run WordPress can't trash is a 500 naming it, and the runs after it are left alone. */
	public function test_a_run_that_cannot_be_trashed_is_a_500(): void {
		$reader = new FakeSessionReader( array( RunFixture::run( id: 4 ), RunFixture::run( id: 6 ), RunFixture::run( id: 7 ) ) );

		Functions\expect( 'wp_trash_post' )->once()->with( 4 )->andReturn( (object) array() );
		Functions\expect( 'wp_trash_post' )->once()->with( 6 )->andReturn( false );

		$result = ( new TrashRuns( $reader ) )->execute( array( 'ids' => array( 4, 6, 7 ) ) );

		$this->assertError( $result, 'bsbench_trash_failed', 500, "The run with the id 6 couldn't be moved to the trash. The runs before it in the list were moved." );
	}

	/**
	 * Every run is restored to the status it had, which is published: while
	 * WordPress restores them the previous-status hook is on, and it is gone after.
	 */
	public function test_restores_every_run_as_published_and_returns_them_as_they_are_now(): void {
		$reader = new FakeSessionReader( array(), array( RunFixture::run( id: 4 ), RunFixture::run( id: 6 ) ) );
		$during = array();

		Functions\when( 'wp_untrash_post' )->alias(
			static function ( int $id ) use ( $reader, &$during ) {
				$during[] = has_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status' );

				return $reader->restore( $id ) ? (object) array() : false;
			}
		);

		$result = ( new RestoreRuns( $reader ) )->execute( array( 'ids' => array( 4, 6 ) ) );

		$this->assertSame( 2, $result['restored_count'] );
		$this->assertSame( array( 4, 6 ), array_column( $result['restored'], 'id' ) );
		$this->assertSame( array( 10, 10 ), $during );
		$this->assertFalse( has_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status' ) );
		$this->assertSame( array( 4, 6 ), array_column( $reader->all(), 'id' ) );
	}

	/** When any id isn't a run in the trash, nothing is restored, and the error names them all. */
	public function test_restores_nothing_when_any_id_is_not_in_the_trash(): void {
		Functions\expect( 'wp_untrash_post' )->never();

		$reader = new FakeSessionReader( array( RunFixture::run( id: 8 ) ), array( RunFixture::run( id: 4 ) ) );

		$this->assertError( ( new RestoreRuns( $reader ) )->execute( array( 'ids' => array( 4, 8, 9 ) ) ), 'bsbench_restore_not_found', 404, "These ids aren't runs in the trash: 8, 9. Nothing was restored." );
	}

	/** A run WordPress can't restore is a 500 naming it, and the status hook is removed all the same. */
	public function test_a_run_that_cannot_be_restored_is_a_500(): void {
		$reader = new FakeSessionReader( array(), array( RunFixture::run( id: 4 ), RunFixture::run( id: 6 ), RunFixture::run( id: 7 ) ) );

		Functions\expect( 'wp_untrash_post' )->once()->with( 4 )->andReturn( (object) array() );
		Functions\expect( 'wp_untrash_post' )->once()->with( 6 )->andReturn( false );

		$result = ( new RestoreRuns( $reader ) )->execute( array( 'ids' => array( 4, 6, 7 ) ) );

		$this->assertError( $result, 'bsbench_restore_failed', 500, "The run with the id 6 couldn't be restored. The runs before it in the list were restored." );
		$this->assertFalse( has_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status' ) );
	}
}
