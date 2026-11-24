<?php
/**
 * Tests for the get-drain-stats ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use DateTimeZone;
use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\GetDrainStats;
use ErdemBircan\BatterySurfBench\Abilities\RunFilter;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use Mockery\MockInterface;
use WP_Error;

/**
 * Behavioral tests for averaging drain figures: which runs are counted, which
 * are measured, the averages, and the fastest and slowest drains.
 */
final class GetDrainStatsTest extends TestCase {

	use AbilityContract;

	/**
	 * The reader double serving the runs.
	 *
	 * @var SessionReader&MockInterface
	 */
	private $reader;

	/**
	 * Stubs the site's clock and timezone, and the date parser.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->reader = Mockery::mock( SessionReader::class );

		Functions\when( 'wp_date' )->justReturn( '2026-11-24T12:00:00+01:00' );
		Functions\when( 'wp_timezone_string' )->justReturn( 'Europe/Berlin' );
		Functions\when( 'wp_timezone' )->justReturn( new DateTimeZone( 'Europe/Berlin' ) );
		Functions\when( 'rest_parse_date' )->alias(
			static fn ( string $value ) => 1 === preg_match( '/T.*(Z|[+-]\d{2}:\d{2})$/', $value ) ? strtotime( $value ) : false
		);
	}

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new GetDrainStats( $this->reader, new RunFilter() );
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
	 * Serves runs.
	 *
	 * @param array<int, array<string, mixed>> $runs The runs.
	 */
	private function serve( array $runs ): void {
		$this->reader->shouldReceive( 'all' )->andReturn( $runs );
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_get_drain_stats(): void {
		$this->assertSame( 'battery-surf-bench/get-drain-stats', $this->ability()->name() );
	}

	/**
	 * The status filter says it defaults to finished runs.
	 */
	public function test_the_status_filter_defaults_to_finished(): void {
		$status = $this->ability()->definition()['input_schema']['properties']['status'];

		$this->assertSame( array( 'finished' ), $status['default'] );
		$this->assertStringEndsWith( 'Defaults to finished runs only.', $status['description'] );
	}

	/**
	 * Averages cover the measured runs; the unmeasured one is counted, listed,
	 * and left out of the averages.
	 */
	public function test_averages_leave_out_runs_that_could_not_be_measured(): void {
		$this->serve(
			array(
				RunFixture::run(
					array(
						'id'                              => 1,
						'drain_rate_session_pct_per_hour' => 9.5,
						'drain_rate_10min_pct_per_hour'   => 9.8,
						'projected_full_runtime_seconds'  => 37895,
						'battery_drop_points'             => 5.0,
						'elapsed_seconds'                 => 1800,
					)
				),
				RunFixture::run(
					array(
						'id'                              => 2,
						'drain_rate_session_pct_per_hour' => 12.5,
						'drain_rate_10min_pct_per_hour'   => 12.9,
						'projected_full_runtime_seconds'  => 28800,
						'battery_drop_points'             => 15.0,
						'elapsed_seconds'                 => 4320,
					)
				),
				RunFixture::run(
					array(
						'id'                              => 3,
						'drain_rate_session_pct_per_hour' => null,
						'drain_rate_10min_pct_per_hour'   => null,
						'projected_full_runtime_seconds'  => null,
						'battery_drop_points'             => 1.0,
						'elapsed_seconds'                 => 900,
					)
				),
			)
		);

		$result = $this->ability()->execute( array() );

		$this->assertSame( 3, $result['runs_matched'] );
		$this->assertSame( 2, $result['runs_measured'] );
		$this->assertSame( array( 3 ), $result['unmeasured_run_ids'] );
		$this->assertSame( 11.0, $result['average_drain_rate_session_pct_per_hour'] );
		$this->assertSame( 11.4, $result['average_drain_rate_10min_pct_per_hour'] );
		$this->assertSame( 33348, $result['average_projected_full_runtime_seconds'] );
		$this->assertSame( 7.0, $result['average_battery_drop_points'] );
		$this->assertSame( 7020, $result['total_elapsed_seconds'] );
		$this->assertSame( '2026-11-24T12:00:00+01:00', $result['now'] );
		$this->assertSame( 'Europe/Berlin', $result['timezone'] );
	}

	/**
	 * Without a status filter only finished runs are counted, and the result says so.
	 */
	public function test_counts_only_finished_runs_by_default(): void {
		$this->serve(
			array(
				RunFixture::run(
					array(
						'id'     => 1,
						'status' => 'finished',
					)
				),
				RunFixture::run(
					array(
						'id'     => 2,
						'status' => 'stopped',
					)
				),
				RunFixture::run(
					array(
						'id'     => 3,
						'status' => 'failed',
					)
				),
			)
		);

		$result = $this->ability()->execute( array() );

		$this->assertSame( 1, $result['runs_matched'] );
		$this->assertSame( array( 'status' => array( 'finished' ) ), $result['filters_applied'] );
	}

	/**
	 * An explicit status filter replaces the default, and the other filters are reported as applied.
	 */
	public function test_an_explicit_filter_replaces_the_default_and_is_reported(): void {
		$this->serve(
			array(
				RunFixture::run(
					array(
						'id'      => 1,
						'status'  => 'finished',
						'browser' => array(
							'name'    => 'Chrome',
							'version' => '1',
							'os'      => 'macOS',
						),
					)
				),
				RunFixture::run(
					array(
						'id'      => 2,
						'status'  => 'failed',
						'browser' => array(
							'name'    => 'Chrome',
							'version' => '1',
							'os'      => 'macOS',
						),
					)
				),
				RunFixture::run(
					array(
						'id'      => 3,
						'status'  => 'failed',
						'browser' => array(
							'name'    => 'Edge',
							'version' => '1',
							'os'      => 'Windows',
						),
					)
				),
			)
		);

		$result = $this->ability()->execute(
			array(
				'status'  => array( 'failed' ),
				'browser' => 'chrome',
			)
		);

		$this->assertSame( 1, $result['runs_matched'] );
		$this->assertSame(
			array(
				'status'  => array( 'failed' ),
				'browser' => 'chrome',
			),
			$result['filters_applied']
		);
	}

	/**
	 * The fastest and slowest drains are the highest and lowest whole-run rate
	 * among measured runs, and a tie goes to the lower id.
	 */
	public function test_names_the_fastest_and_slowest_drain_and_breaks_ties_by_lower_id(): void {
		$this->serve(
			array(
				RunFixture::run(
					array(
						'id'                              => 4,
						'drain_rate_session_pct_per_hour' => 22.2,
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
						'id'                              => 7,
						'drain_rate_session_pct_per_hour' => 8.2,
					)
				),
				RunFixture::run(
					array(
						'id'                              => 5,
						'drain_rate_session_pct_per_hour' => 8.2,
					)
				),
				RunFixture::run(
					array(
						'id'                              => 6,
						'drain_rate_session_pct_per_hour' => null,
					)
				),
			)
		);

		$result = $this->ability()->execute( array() );

		$this->assertSame(
			array(
				'id'                              => 2,
				'drain_rate_session_pct_per_hour' => 22.2,
			),
			$result['fastest_drain']
		);
		$this->assertSame(
			array(
				'id'                              => 5,
				'drain_rate_session_pct_per_hour' => 8.2,
			),
			$result['slowest_drain']
		);
	}

	/**
	 * When no run matches, the counts are zero and every average and extreme is null.
	 */
	public function test_no_matching_runs_gives_zero_counts_and_null_figures(): void {
		$this->serve( array() );

		$result = $this->ability()->execute( array() );

		$this->assertSame( 0, $result['runs_matched'] );
		$this->assertSame( 0, $result['runs_measured'] );
		$this->assertSame( array(), $result['unmeasured_run_ids'] );
		$this->assertNull( $result['average_drain_rate_session_pct_per_hour'] );
		$this->assertNull( $result['average_drain_rate_10min_pct_per_hour'] );
		$this->assertNull( $result['average_projected_full_runtime_seconds'] );
		$this->assertNull( $result['average_battery_drop_points'] );
		$this->assertSame( 0, $result['total_elapsed_seconds'] );
		$this->assertNull( $result['fastest_drain'] );
		$this->assertNull( $result['slowest_drain'] );
	}

	/**
	 * A date filter that can't be read is the agent's error to fix.
	 */
	public function test_an_unreadable_date_is_an_error(): void {
		$this->serve( array() );

		$result = $this->ability()->execute( array( 'started_before' => 'someday' ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_invalid_date', $result->get_error_code() );
	}
}
