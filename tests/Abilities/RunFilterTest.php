<?php
/**
 * Tests for the run filter.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use ErdemBircan\BatterySurfBench\Abilities\RunFilter;

/**
 * Behavioral tests for filtering and sorting normalized runs: each criterion,
 * date boundaries read in the site's timezone, and a sort that compares numbers
 * as numbers and always puts a run with no figure last.
 */
final class RunFilterTest extends AbilityTestCase {

	/** Stubs the site's timezone as Berlin (UTC+1 in November) and core's date parser. */
	protected function setUp(): void {
		parent::setUp();

		$this->stub_site_time();
	}

	/**
	 * Lists the ids of runs, for readable assertions.
	 *
	 * @param mixed $runs The runs, or an error.
	 * @return array<int, int> The ids, in order.
	 */
	private function ids( mixed $runs ): array {
		$this->assertIsArray( $runs );

		return array_column( $runs, 'id' );
	}

	/**
	 * Builds a browser block.
	 *
	 * @param string|null $name The browser name.
	 * @param string|null $os   The operating system.
	 * @return array<string, string|null> The browser.
	 */
	private function browser( ?string $name, ?string $os ): array {
		return array(
			'name'    => $name,
			'version' => null,
			'os'      => $os,
		);
	}

	/**
	 * Three runs that differ in each field the filters read.
	 *
	 * @return array<int, array<string, mixed>> The runs.
	 */
	private function runs(): array {
		return array(
			RunFixture::run( id: 1, status: 'finished', mode: 'duration', started_at: '2026-11-10T10:00:00+01:00', browser: $this->browser( 'Chrome', 'macOS' ) ),
			RunFixture::run( id: 2, status: 'failed', mode: 'target', started_at: '2026-11-15T09:30:00+01:00', browser: $this->browser( 'Microsoft Edge', 'Windows' ) ),
			RunFixture::run( id: 3, status: 'finished', mode: 'target', started_at: null, browser: $this->browser( null, null ) ),
		);
	}

	/** Each criterion keeps the runs that match it; no criteria keeps every run. */
	public function test_each_criterion_narrows_the_runs(): void {
		$filter = new RunFilter();
		$cases  = array(
			array( array(), array( 1, 2, 3 ) ),
			array( array( 'status' => array( 'finished' ) ), array( 1, 3 ) ),
			array( array( 'status' => 'finished,failed' ), array( 1, 2, 3 ) ),
			array( array( 'mode' => array( 'target' ) ), array( 2, 3 ) ),
			array( array( 'browser' => 'EDGE' ), array( 2 ) ),
			array( array( 'browser' => 'chrom' ), array( 1 ) ),
			array( array( 'os' => 'windows' ), array( 2 ) ),
		);

		foreach ( $cases as list( $input, $expected ) ) {
			$this->assertSame( $expected, $this->ids( $filter->filter( $this->runs(), $input ) ), wp_json_encode( $input ) );
		}
	}

	/** The start of a date range is inclusive, the end exclusive, and a run with no start never matches. */
	public function test_date_filters_include_the_start_exclude_the_end_and_skip_runs_without_a_start(): void {
		$filter = new RunFilter();
		$cases  = array(
			array( array( 'started_after' => '2026-11-15T09:30:00+01:00' ), array( 2 ) ),
			array( array( 'started_before' => '2026-11-15T09:30:00+01:00' ), array( 1 ) ),
			array( array( 'started_after' => '2026-11-01' ), array( 1, 2 ) ),
		);

		foreach ( $cases as list( $input, $expected ) ) {
			$this->assertSame( $expected, $this->ids( $filter->filter( $this->runs(), $input ) ), wp_json_encode( $input ) );
		}
	}

	/** A bare date is midnight at the start of that day in the site's timezone, not in UTC. */
	public function test_a_bare_date_is_midnight_in_the_sites_timezone(): void {
		$filter = new RunFilter();
		$runs   = array( RunFixture::run( id: 9, started_at: '2026-11-15T00:30:00+01:00' ) );

		// Midnight 15 November in Berlin is 23:00 UTC on the 14th.
		$this->assertSame( strtotime( '2026-11-14T23:00:00Z' ), $filter->parse_date( '2026-11-15' ) );
		$this->assertSame( strtotime( '2026-11-15T09:30:00+01:00' ), $filter->parse_date( '2026-11-15T09:30:00+01:00' ) );
		$this->assertSame( array( 9 ), $this->ids( $filter->filter( $runs, array( 'started_after' => '2026-11-15' ) ) ) );
		$this->assertSame( array(), $this->ids( $filter->filter( $runs, array( 'started_before' => '2026-11-15' ) ) ) );
	}

	/** Text that isn't a date, a day that doesn't exist, and a bad end date are each refused with a 400. */
	public function test_unreadable_dates_are_refused(): void {
		$filter = new RunFilter();

		$this->assertError( $filter->filter( $this->runs(), array( 'started_after' => 'last tuesday' ) ), 'bsbench_invalid_date', 400 );
		$this->assertError(
			$filter->filter(
				$this->runs(),
				array(
					'started_after'  => '2026-11-01',
					'started_before' => 'soon',
				)
			),
			'bsbench_invalid_date',
			400
		);
		$this->assertError( $filter->parse_date( '2026-02-31' ), 'bsbench_invalid_date', 400 );
		$this->assertStringContainsString( 'last tuesday', $filter->filter( $this->runs(), array( 'started_after' => 'last tuesday' ) )->get_error_message() );
	}

	/** Sorting compares numbers as numbers, puts runs without a figure last in either direction, and breaks ties by id. */
	public function test_sort_compares_numbers_puts_missing_values_last_and_breaks_ties_by_id(): void {
		$filter = new RunFilter();
		$rates  = array(
			RunFixture::run( id: 1, drain_rate_session_pct_per_hour: 12.5 ),
			RunFixture::run( id: 2, drain_rate_session_pct_per_hour: 22.2 ),
			RunFixture::run( id: 3, drain_rate_session_pct_per_hour: 9.5 ),
			RunFixture::run( id: 4, drain_rate_session_pct_per_hour: null ),
		);

		$this->assertSame( array( 3, 1, 2, 4 ), $this->ids( $filter->sort( $rates, 'drain_rate_session', 'asc' ) ) );
		$this->assertSame( array( 2, 1, 3, 4 ), $this->ids( $filter->sort( $rates, 'drain_rate_session', 'desc' ) ) );

		$ties = array( RunFixture::run( id: 4, battery_drop_points: 5.0 ), RunFixture::run( id: 7, battery_drop_points: 5.0 ), RunFixture::run( id: 5, battery_drop_points: 5.0 ) );

		$this->assertSame( array( 7, 5, 4 ), $this->ids( $filter->sort( $ties, 'battery_drop', 'desc' ) ) );
		$this->assertSame( array( 4, 5, 7 ), $this->ids( $filter->sort( $ties, 'battery_drop', 'asc' ) ) );

		$missing = array( RunFixture::run( id: 1, drain_rate_10min_pct_per_hour: null ), RunFixture::run( id: 2, drain_rate_10min_pct_per_hour: null ) );

		$this->assertSame( array( 2, 1 ), $this->ids( $filter->sort( $missing, 'drain_rate_10min', 'desc' ) ) );
	}

	/** Each sort field reads its own figure; a missing start counts as the earliest. */
	public function test_sort_fields_read_their_own_figures(): void {
		$filter  = new RunFilter();
		$runtime = array(
			RunFixture::run( id: 1, projected_full_runtime_seconds: null ),
			RunFixture::run( id: 2, projected_full_runtime_seconds: 30000 ),
			RunFixture::run( id: 3, projected_full_runtime_seconds: 40000 ),
		);
		$length  = array( RunFixture::run( id: 1, elapsed_seconds: 600 ), RunFixture::run( id: 2, elapsed_seconds: 7200 ) );

		$this->assertSame( array( 2, 3, 1 ), $this->ids( $filter->sort( $runtime, 'projected_runtime', 'asc' ) ) );
		$this->assertSame( array( 3, 2, 1 ), $this->ids( $filter->sort( $runtime, 'projected_runtime', 'desc' ) ) );
		$this->assertSame( array( 2, 1 ), $this->ids( $filter->sort( $length, 'elapsed', 'desc' ) ) );
		$this->assertSame( array( 2, 1, 3 ), $this->ids( $filter->sort( $this->runs(), 'started_at', 'desc' ) ) );
		$this->assertSame( array( 3, 1, 2 ), $this->ids( $filter->sort( $this->runs(), 'started_at', 'asc' ) ) );
	}
}
