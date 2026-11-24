<?php
/**
 * Tests for the get-drain-stats ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\GetDrainStats;
use ErdemBircan\BatterySurfBench\Abilities\RunFilter;

/** Behavioral tests for averaging drain figures: which runs are counted, which are measured, and the extremes. */
final class GetDrainStatsTest extends AbilityTestCase {

	/** Stubs the site's clock, timezone and date parser. */
	protected function setUp(): void {
		parent::setUp();

		$this->stub_site_time();
	}

	/**
	 * Builds the ability over runs.
	 *
	 * @param array<int, array<string, mixed>> $runs The recorded runs.
	 * @return GetDrainStats The ability.
	 */
	private function stats( array $runs ): GetDrainStats {
		return new GetDrainStats( new FakeSessionReader( $runs ), new RunFilter() );
	}

	/** Averages cover the measured runs, drop included; the unmeasured run is counted and listed but left out, and its time still counts toward the total. */
	public function test_averages_leave_out_runs_that_could_not_be_measured(): void {
		$result = $this->stats(
			array(
				RunFixture::run( id: 1, drain_rate_session_pct_per_hour: 9.5, drain_rate_10min_pct_per_hour: 9.8, projected_full_runtime_seconds: 37895, battery_drop_points: 5.0, elapsed_seconds: 1800 ),
				RunFixture::run( id: 2, drain_rate_session_pct_per_hour: 12.5, drain_rate_10min_pct_per_hour: 12.9, projected_full_runtime_seconds: 28800, battery_drop_points: 15.0, elapsed_seconds: 4320 ),
				RunFixture::run( id: 3, drain_rate_session_pct_per_hour: null, drain_rate_10min_pct_per_hour: null, projected_full_runtime_seconds: null, battery_drop_points: 1.0, elapsed_seconds: 900 ),
			)
		)->execute( array() );

		$this->assertSame( array( 3, 2, array( 3 ) ), array( $result['runs_matched'], $result['runs_measured'], $result['unmeasured_run_ids'] ) );
		$this->assertSame( 11.0, $result['average_drain_rate_session_pct_per_hour'] );
		$this->assertSame( 11.4, $result['average_drain_rate_10min_pct_per_hour'] );
		$this->assertSame( 33348, $result['average_projected_full_runtime_seconds'] );
		$this->assertSame( 10.0, $result['average_battery_drop_points'] );
		$this->assertSame( 7020, $result['total_elapsed_seconds'] );
		$this->assertSame( 'Europe/Berlin', $result['timezone'] );
	}

	/** Without a status filter only finished runs count, and the result says so; an explicit filter replaces that and is reported. */
	public function test_the_status_defaults_to_finished_and_filters_are_reported(): void {
		$runs  = array(
			RunFixture::run( id: 1 ),
			RunFixture::run( id: 2, status: 'stopped' ),
			RunFixture::run(
				id: 3,
				status: 'failed',
				browser: array(
					'name'    => 'Chrome',
					'version' => '1',
					'os'      => 'macOS',
				)
			),
		);
		$stats = $this->stats( $runs );

		$default = $stats->execute( array() );

		$this->assertSame( 1, $default['runs_matched'] );
		$this->assertSame( array( 'status' => array( 'finished' ) ), $default['filters_applied'] );

		$explicit = $stats->execute(
			array(
				'status'  => array( 'failed' ),
				'browser' => 'chrome',
			)
		);

		$this->assertSame( 1, $explicit['runs_matched'] );
		$this->assertSame(
			array(
				'status'  => array( 'failed' ),
				'browser' => 'chrome',
			),
			$explicit['filters_applied']
		);
	}

	/** The fastest and slowest drains are the highest and lowest whole-run rate among measured runs, and a tie goes to the lower id. */
	public function test_names_the_fastest_and_slowest_drain_and_breaks_ties_by_lower_id(): void {
		$result = $this->stats(
			array(
				RunFixture::run( id: 4, drain_rate_session_pct_per_hour: 22.2 ),
				RunFixture::run( id: 2, drain_rate_session_pct_per_hour: 22.2 ),
				RunFixture::run( id: 7, drain_rate_session_pct_per_hour: 8.2 ),
				RunFixture::run( id: 5, drain_rate_session_pct_per_hour: 8.2 ),
				RunFixture::run( id: 6, drain_rate_session_pct_per_hour: null ),
			)
		)->execute( array() );

		$this->assertSame( 2, $result['fastest_drain']['id'] );
		$this->assertSame( 22.2, $result['fastest_drain']['drain_rate_session_pct_per_hour'] );
		$this->assertSame( 5, $result['slowest_drain']['id'] );
	}

	/** When no run matches, the counts are zero and every average and extreme is null. */
	public function test_no_matching_runs_gives_zero_counts_and_null_figures(): void {
		$result = $this->stats( array() )->execute( array() );

		$this->assertSame( array( 0, 0, array(), 0 ), array( $result['runs_matched'], $result['runs_measured'], $result['unmeasured_run_ids'], $result['total_elapsed_seconds'] ) );

		foreach ( array( 'average_drain_rate_session_pct_per_hour', 'average_drain_rate_10min_pct_per_hour', 'average_projected_full_runtime_seconds', 'average_battery_drop_points', 'fastest_drain', 'slowest_drain' ) as $key ) {
			$this->assertNull( $result[ $key ], $key );
		}
	}

	/** A date filter that can't be read is the agent's error to fix. */
	public function test_an_unreadable_date_is_an_error(): void {
		$this->assertError( $this->stats( array() )->execute( array( 'started_before' => 'someday' ) ), 'bsbench_invalid_date', 400 );
	}
}
