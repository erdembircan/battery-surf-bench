<?php
/**
 * Tests for the get-run ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\GetRun;

/** Behavioral tests for getting one run: the one asked for, or the newest. */
final class GetRunTest extends AbilityTestCase {

	/** An id returns that run, in full. */
	public function test_returns_the_run_with_the_given_id(): void {
		$run = RunFixture::run( id: 12 );

		$this->assertSame( $run, ( new GetRun( new FakeSessionReader( array( RunFixture::run( id: 3 ), $run ) ) ) )->execute( array( 'id' => 12 ) ) );
	}

	/** With no id, the newest run is returned. */
	public function test_returns_the_newest_run_when_no_id_is_given(): void {
		$newest = RunFixture::run( id: 30 );

		$this->assertSame( $newest, ( new GetRun( new FakeSessionReader( array( RunFixture::run( id: 3 ), $newest ) ) ) )->execute( array() ) );
	}

	/** With no id and no runs recorded, that is a 404 saying so. */
	public function test_no_runs_recorded_is_a_404(): void {
		$this->assertError( ( new GetRun( new FakeSessionReader() ) )->execute( array() ), 'bsbench_no_runs', 404, 'No benchmark runs have been recorded yet.' );
	}

	/** An id that isn't a recorded run, even a trashed one, is a 404 naming the id. */
	public function test_an_unknown_or_trashed_id_is_a_404(): void {
		$get = new GetRun( new FakeSessionReader( array(), array( RunFixture::run( id: 8 ) ) ) );

		$this->assertError( $get->execute( array( 'id' => 99 ) ), 'bsbench_run_not_found', 404, "There's no benchmark run with the id 99." );
		$this->assertError( $get->execute( array( 'id' => 8 ) ), 'bsbench_run_not_found', 404 );
	}
}
