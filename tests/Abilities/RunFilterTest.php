<?php
/**
 * Tests for the run filter.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use DateTimeZone;
use ErdemBircan\BatterySurfBench\Abilities\RunFilter;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use WP_Error;

/**
 * Behavioral tests for filtering and sorting normalized runs: each criterion,
 * date boundaries read in the site's timezone, and a sort that compares numbers
 * as numbers and always puts a run with no figure last.
 */
final class RunFilterTest extends TestCase {

	/**
	 * Stubs the site's timezone as Berlin (UTC+1 in November) and the RFC 3339
	 * date parser as core's own reads it.
	 */
	protected function setUp(): void {
		parent::setUp();

		Functions\when( 'wp_timezone' )->justReturn( new DateTimeZone( 'Europe/Berlin' ) );
		Functions\when( 'rest_parse_date' )->alias(
			static function ( string $value ) {
				$timestamp = strtotime( $value );

				return false === $timestamp || 1 !== preg_match( '/T.*(Z|[+-]\d{2}:\d{2})$/', $value ) ? false : $timestamp;
			}
		);
	}

	/**
	 * Lists the ids of runs, for readable assertions.
	 *
	 * @param array<int, array<string, mixed>>|WP_Error $runs The runs.
	 * @return array<int, int> The ids, in order.
	 */
	private function ids( $runs ): array {
		$this->assertIsArray( $runs );

		return array_map( static fn ( array $run ): int => $run['id'], $runs );
	}

	/**
	 * A handful of runs that differ in each field the filters read.
	 *
	 * @return array<int, array<string, mixed>> The runs.
	 */
	private function runs(): array {
		return array(
			RunFixture::run(
				array(
					'id'         => 1,
					'status'     => 'finished',
					'mode'       => 'duration',
					'started_at' => '2026-11-10T10:00:00+01:00',
					'browser'    => array(
						'name'    => 'Chrome',
						'version' => '142',
						'os'      => 'macOS',
					),
				)
			),
			RunFixture::run(
				array(
					'id'         => 2,
					'status'     => 'failed',
					'mode'       => 'target',
					'started_at' => '2026-11-15T09:30:00+01:00',
					'browser'    => array(
						'name'    => 'Microsoft Edge',
						'version' => '141',
						'os'      => 'Windows',
					),
				)
			),
			RunFixture::run(
				array(
					'id'         => 3,
					'status'     => 'finished',
					'mode'       => 'target',
					'started_at' => null,
					'browser'    => array(
						'name'    => null,
						'version' => null,
						'os'      => null,
					),
				)
			),
		);
	}

	/**
	 * No criteria keeps every run.
	 */
	public function test_filter_without_criteria_keeps_every_run(): void {
		$this->assertSame( array( 1, 2, 3 ), $this->ids( ( new RunFilter() )->filter( $this->runs(), array() ) ) );
	}

	/**
	 * A status list keeps the runs with one of those statuses.
	 */
	public function test_filter_by_status_keeps_runs_with_one_of_the_statuses(): void {
		$filter = new RunFilter();

		$this->assertSame( array( 1, 3 ), $this->ids( $filter->filter( $this->runs(), array( 'status' => array( 'finished' ) ) ) ) );
		$this->assertSame( array( 1, 2, 3 ), $this->ids( $filter->filter( $this->runs(), array( 'status' => array( 'finished', 'failed' ) ) ) ) );
	}

	/**
	 * A transport that sends a list as one comma-separated string means the list.
	 */
	public function test_filter_reads_a_comma_separated_list(): void {
		$filter = new RunFilter();

		$this->assertSame( array( 1, 2, 3 ), $this->ids( $filter->filter( $this->runs(), array( 'status' => 'finished,failed' ) ) ) );
	}

	/**
	 * A mode list keeps the runs in one of those modes.
	 */
	public function test_filter_by_mode_keeps_runs_in_one_of_the_modes(): void {
		$this->assertSame( array( 2, 3 ), $this->ids( ( new RunFilter() )->filter( $this->runs(), array( 'mode' => array( 'target' ) ) ) ) );
	}

	/**
	 * The browser name is matched as a substring, ignoring case; a run with no
	 * name never matches.
	 */
	public function test_filter_by_browser_matches_a_substring_ignoring_case(): void {
		$filter = new RunFilter();

		$this->assertSame( array( 2 ), $this->ids( $filter->filter( $this->runs(), array( 'browser' => 'EDGE' ) ) ) );
		$this->assertSame( array( 1 ), $this->ids( $filter->filter( $this->runs(), array( 'browser' => 'chrom' ) ) ) );
	}

	/**
	 * The operating system is matched the same way, on its own field.
	 */
	public function test_filter_by_os_matches_a_substring_ignoring_case(): void {
		$this->assertSame( array( 2 ), $this->ids( ( new RunFilter() )->filter( $this->runs(), array( 'os' => 'windows' ) ) ) );
	}

	/**
	 * The start of a date range is inclusive, the end exclusive, and a run with
	 * no start never matches a date criterion.
	 */
	public function test_filter_by_dates_includes_the_start_excludes_the_end_and_skips_runs_without_a_start(): void {
		$filter = new RunFilter();

		$this->assertSame(
			array( 2 ),
			$this->ids( $filter->filter( $this->runs(), array( 'started_after' => '2026-11-15T09:30:00+01:00' ) ) )
		);
		$this->assertSame(
			array( 1 ),
			$this->ids( $filter->filter( $this->runs(), array( 'started_before' => '2026-11-15T09:30:00+01:00' ) ) )
		);
		$this->assertSame(
			array( 1, 2 ),
			$this->ids( $filter->filter( $this->runs(), array( 'started_after' => '2026-11-01' ) ) )
		);
	}

	/**
	 * A bare date means midnight at the start of that day in the site's
	 * timezone, not in UTC.
	 */
	public function test_a_bare_date_is_midnight_in_the_sites_timezone(): void {
		$filter = new RunFilter();

		// Midnight 15 November in Berlin is 23:00 UTC on the 14th.
		$this->assertSame( 1_794_697_200, $filter->parse_date( '2026-11-15' ) );

		// A run at 00:30 Berlin time on the 15th (23:30 UTC on the 14th) started
		// on the 15th for this site, so a 15 November start boundary keeps it.
		$runs = array(
			RunFixture::run(
				array(
					'id'         => 9,
					'started_at' => '2026-11-15T00:30:00+01:00',
				)
			),
		);

		$this->assertSame( array( 9 ), $this->ids( $filter->filter( $runs, array( 'started_after' => '2026-11-15' ) ) ) );
		$this->assertSame( array(), $this->ids( $filter->filter( $runs, array( 'started_before' => '2026-11-15' ) ) ) );
	}

	/**
	 * A date and time with an offset is read as the moment it names.
	 */
	public function test_a_date_time_with_an_offset_is_read_as_that_moment(): void {
		$this->assertSame( 1_794_731_400, ( new RunFilter() )->parse_date( '2026-11-15T09:30:00+01:00' ) );
	}

	/**
	 * Text that isn't a date is refused with an error an agent can act on.
	 */
	public function test_an_unreadable_date_is_a_400_error(): void {
		$result = ( new RunFilter() )->filter( $this->runs(), array( 'started_after' => 'last tuesday' ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_invalid_date', $result->get_error_code() );
		$this->assertSame( array( 'status' => 400 ), $result->get_error_data() );
		$this->assertStringContainsString( 'last tuesday', $result->get_error_message() );
	}

	/**
	 * A date that has the shape of a day but names none is refused too.
	 */
	public function test_a_day_that_does_not_exist_is_refused(): void {
		$result = ( new RunFilter() )->parse_date( '2026-02-31' );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_invalid_date', $result->get_error_code() );
	}

	/**
	 * A bad end date is refused even when the start date reads fine.
	 */
	public function test_a_bad_end_date_is_refused(): void {
		$result = ( new RunFilter() )->filter(
			$this->runs(),
			array(
				'started_after'  => '2026-11-01',
				'started_before' => 'soon',
			)
		);

		$this->assertInstanceOf( WP_Error::class, $result );
	}

	/**
	 * Sorting compares numbers as numbers: 9.5 comes before 12.5 and 22.2, which
	 * a text comparison would get wrong.
	 */
	public function test_sort_compares_numbers_not_text(): void {
		$runs   = array(
			RunFixture::run(
				array(
					'id'                              => 1,
					'drain_rate_session_pct_per_hour' => 12.5,
				)
			),
			RunFixture::run(
				array(
					'id'                              => 2,
					'drain_rate_session_pct_per_hour' => 22.2,
				)
			),
			RunFixture::run(
				array(
					'id'                              => 3,
					'drain_rate_session_pct_per_hour' => 9.5,
				)
			),
		);
		$filter = new RunFilter();

		$this->assertSame( array( 3, 1, 2 ), $this->ids( $filter->sort( $runs, 'drain_rate_session', 'asc' ) ) );
		$this->assertSame( array( 2, 1, 3 ), $this->ids( $filter->sort( $runs, 'drain_rate_session', 'desc' ) ) );
	}

	/**
	 * A run with no figure for the sort field comes last, in either direction.
	 */
	public function test_sort_puts_runs_without_a_value_last_in_both_directions(): void {
		$runs   = array(
			RunFixture::run(
				array(
					'id'                             => 1,
					'projected_full_runtime_seconds' => null,
				)
			),
			RunFixture::run(
				array(
					'id'                             => 2,
					'projected_full_runtime_seconds' => 30000,
				)
			),
			RunFixture::run(
				array(
					'id'                             => 3,
					'projected_full_runtime_seconds' => 40000,
				)
			),
		);
		$filter = new RunFilter();

		$this->assertSame( array( 2, 3, 1 ), $this->ids( $filter->sort( $runs, 'projected_runtime', 'asc' ) ) );
		$this->assertSame( array( 3, 2, 1 ), $this->ids( $filter->sort( $runs, 'projected_runtime', 'desc' ) ) );
	}

	/**
	 * Runs with the same figure keep the higher id first when descending and the
	 * lower id first when ascending.
	 */
	public function test_sort_breaks_ties_by_id_by_direction(): void {
		$runs   = array(
			RunFixture::run(
				array(
					'id'                  => 4,
					'battery_drop_points' => 5.0,
				)
			),
			RunFixture::run(
				array(
					'id'                  => 7,
					'battery_drop_points' => 5.0,
				)
			),
			RunFixture::run(
				array(
					'id'                  => 5,
					'battery_drop_points' => 5.0,
				)
			),
		);
		$filter = new RunFilter();

		$this->assertSame( array( 7, 5, 4 ), $this->ids( $filter->sort( $runs, 'battery_drop', 'desc' ) ) );
		$this->assertSame( array( 4, 5, 7 ), $this->ids( $filter->sort( $runs, 'battery_drop', 'asc' ) ) );
	}

	/**
	 * Runs with no value at all also tie by id.
	 */
	public function test_sort_breaks_ties_between_runs_without_a_value_by_id(): void {
		$runs = array(
			RunFixture::run(
				array(
					'id'                            => 1,
					'drain_rate_10min_pct_per_hour' => null,
				)
			),
			RunFixture::run(
				array(
					'id'                            => 2,
					'drain_rate_10min_pct_per_hour' => null,
				)
			),
		);

		$this->assertSame( array( 2, 1 ), $this->ids( ( new RunFilter() )->sort( $runs, 'drain_rate_10min', 'desc' ) ) );
	}

	/**
	 * Sorting by start puts the latest first when descending; a run with no
	 * start counts as the earliest.
	 */
	public function test_sort_by_start_orders_by_moment_and_counts_a_missing_start_as_earliest(): void {
		$runs   = $this->runs();
		$filter = new RunFilter();

		$this->assertSame( array( 2, 1, 3 ), $this->ids( $filter->sort( $runs, 'started_at', 'desc' ) ) );
		$this->assertSame( array( 3, 1, 2 ), $this->ids( $filter->sort( $runs, 'started_at', 'asc' ) ) );
	}

	/**
	 * Sorting by length reads the elapsed seconds.
	 */
	public function test_sort_by_elapsed_reads_the_length_of_the_run(): void {
		$runs = array(
			RunFixture::run(
				array(
					'id'              => 1,
					'elapsed_seconds' => 600,
				)
			),
			RunFixture::run(
				array(
					'id'              => 2,
					'elapsed_seconds' => 7200,
				)
			),
		);

		$this->assertSame( array( 2, 1 ), $this->ids( ( new RunFilter() )->sort( $runs, 'elapsed', 'desc' ) ) );
	}
}
