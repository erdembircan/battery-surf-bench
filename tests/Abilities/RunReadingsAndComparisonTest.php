<?php
/**
 * Tests for the get-run-readings and compare-runs abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\CompareRuns;
use ErdemBircan\BatterySurfBench\Abilities\GetRunReadings;

/** Behavioral tests for reading a run's readings and comparing runs side by side. */
final class RunReadingsAndComparisonTest extends AbilityTestCase {

	/** The run's readings come back with their count. */
	public function test_returns_the_readings_with_their_count(): void {
		$readings = array(
			array(
				'elapsed_seconds' => 0.0,
				'battery_percent' => 98.0,
				'charging'        => false,
				'repeat_count'    => 3,
			),
			array(
				'elapsed_seconds' => 360.0,
				'battery_percent' => 97.0,
				'charging'        => false,
				'repeat_count'    => 3,
			),
		);
		$ability  = new GetRunReadings( new FakeSessionReader( array( RunFixture::run( id: 12 ) ), array(), array( 12 => $readings ) ) );

		$this->assertSame(
			array(
				'id'            => 12,
				'reading_count' => 2,
				'readings'      => $readings,
			),
			$ability->execute( array( 'id' => 12 ) )
		);
	}

	/** A run that isn't recorded has no readings to return: a 404 naming the id. */
	public function test_readings_of_an_unknown_run_are_a_404(): void {
		$this->assertError( ( new GetRunReadings( new FakeSessionReader() ) )->execute( array( 'id' => 99 ) ), 'bsbench_run_not_found', 404, "There's no benchmark run with the id 99." );
	}

	/** The runs come back in the order they were asked for, not the order they were recorded. */
	public function test_compare_returns_the_runs_in_the_order_given(): void {
		$compare = new CompareRuns( new FakeSessionReader( array( RunFixture::run( id: 3 ), RunFixture::run( id: 9 ) ) ) );

		$this->assertSame( array( 9, 3 ), array_column( $compare->execute( array( 'ids' => array( 9, 3 ) ) )['runs'], 'id' ) );
	}

	/** Every id that isn't a recorded run is named in one 404. */
	public function test_compare_names_every_unknown_id(): void {
		$compare = new CompareRuns( new FakeSessionReader( array( RunFixture::run( id: 1 ) ) ) );

		$this->assertError( $compare->execute( array( 'ids' => array( 8, 1, 9 ) ) ), 'bsbench_compare_not_found', 404, "These ids aren't recorded benchmark runs: 8, 9." );
	}
}
