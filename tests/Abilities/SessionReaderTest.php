<?php
/**
 * Tests for the session reader.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use DateTimeImmutable;
use DateTimeZone;
use ErdemBircan\BatterySurfBench\Abilities\SessionReader;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use WP_Post;

/**
 * Behavioral tests for reading stored sessions as normalized runs: the figures
 * an agent sees (percentages, nulls for what a run couldn't measure, dates in
 * the site's timezone, a sentence for how it ended), the paging that reads
 * every published session, and the checks that keep other posts out.
 */
final class SessionReaderTest extends TestCase {

	/**
	 * Sessions the stubs serve: id => array( post_type, post_status, meta ).
	 *
	 * @var array<int, array{type: string, status: string, meta: array<string, mixed>}>
	 */
	private array $posts = array();

	/**
	 * The `get_posts()` arguments each page was read with, in call order.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	private array $queries = array();

	/**
	 * Stubs the WordPress functions the reader calls, backed by `$posts`.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->posts   = array();
		$this->queries = array();

		Functions\when( 'get_posts' )->alias(
			function ( array $args ): array {
				$this->queries[] = $args;
				$ids             = array();

				foreach ( $this->posts as $id => $post ) {
					if ( $post['type'] === $args['post_type'] && $post['status'] === $args['post_status'] ) {
						$ids[] = $id;
					}
				}

				return array_slice( $ids, ( $args['paged'] - 1 ) * $args['posts_per_page'], $args['posts_per_page'] );
			}
		);
		Functions\when( 'get_post' )->alias(
			function ( int $id ) {
				if ( ! isset( $this->posts[ $id ] ) ) {
					return null;
				}

				return new WP_Post(
					(object) array(
						'ID'          => $id,
						'post_type'   => $this->posts[ $id ]['type'],
						'post_status' => $this->posts[ $id ]['status'],
					)
				);
			}
		);
		Functions\when( 'get_post_meta' )->alias(
			fn ( int $id, string $key ) => $this->posts[ $id ]['meta'][ $key ] ?? ''
		);
		Functions\when( 'admin_url' )->alias( static fn ( string $path ): string => 'https://example.test/wp-admin/' . $path );
		Functions\when( 'wp_date' )->alias(
			static fn ( string $format, int $timestamp ): string => ( new DateTimeImmutable( '@' . $timestamp ) )
				->setTimezone( new DateTimeZone( 'Europe/Berlin' ) )
				->format( $format )
		);
	}

	/**
	 * Builds the reader under test.
	 *
	 * @return SessionReader The reader.
	 */
	private function reader(): SessionReader {
		return new SessionReader( 'bsbench_session', 'bsbench_', 'bsbench-session', 'bsbenchSessionId' );
	}

	/**
	 * Stores a published session whose meta is the given values, under their bare names.
	 *
	 * @param int                  $id     The session id.
	 * @param array<string, mixed> $meta   Meta values keyed by bare field name.
	 * @param string               $status The post status.
	 * @param string               $type   The post type.
	 */
	private function session( int $id, array $meta = array(), string $status = 'publish', string $type = 'bsbench_session' ): void {
		$prefixed = array();

		foreach ( $meta as $field => $value ) {
			$prefixed[ 'bsbench_' . $field ] = $value;
		}

		$this->posts[ $id ] = array(
			'type'   => $type,
			'status' => $status,
			'meta'   => $prefixed,
		);
	}

	/**
	 * A finished duration run as the cockpit stores it.
	 *
	 * @return array<string, mixed> Meta keyed by bare field name.
	 */
	private function finished_duration_meta(): array {
		return array(
			'status'          => 'finished',
			'mode'            => 'duration',
			'config_mode'     => 'duration',
			'config_duration' => 3600,
			'started_at'      => '2026-11-24T09:30:00.000Z',
			'ended_at'        => '2026-11-24T10:30:00.000Z',
			'start_level'     => 0.98,
			'end_level'       => 0.88,
			'dropped_pct'     => 10.0,
			'elapsed'         => 3600,
			'rate_session'    => 10.0,
			'rate_10'         => 10.4,
			'time_to_empty'   => 36000,
			'ua_browser'      => 'Chrome',
			'ua_version'      => '142',
			'ua_os'           => 'macOS',
			'samples'         => array(
				array(
					't'        => 0,
					'level'    => 0.98,
					'charging' => false,
					'count'    => 3,
				),
				array(
					't'        => 360000,
					'level'    => 0.97,
					'charging' => false,
					'count'    => 3,
				),
			),
		);
	}

	/**
	 * A stored run reads as the figures an agent can reason about, in a fixed key order.
	 */
	public function test_find_normalizes_a_finished_duration_run(): void {
		$this->session( 12, $this->finished_duration_meta() );

		$run = $this->reader()->find( 12 );

		$this->assertSame(
			array(
				'id',
				'status',
				'end_reason',
				'outcome',
				'mode',
				'started_at',
				'ended_at',
				'elapsed_seconds',
				'battery_start_percent',
				'battery_end_percent',
				'battery_drop_points',
				'drain_rate_session_pct_per_hour',
				'drain_rate_10min_pct_per_hour',
				'projected_full_runtime_seconds',
				'setup',
				'browser',
				'reading_count',
				'report_url',
			),
			array_keys( $run )
		);
		$this->assertSame( 12, $run['id'] );
		$this->assertSame( 'finished', $run['status'] );
		$this->assertSame( 'duration', $run['end_reason'] );
		$this->assertSame( 'Finished: it ran for its full set duration.', $run['outcome'] );
		$this->assertSame( 'duration', $run['mode'] );
		$this->assertSame( 3600, $run['elapsed_seconds'] );
		$this->assertSame( 98.0, $run['battery_start_percent'] );
		$this->assertSame( 88.0, $run['battery_end_percent'] );
		$this->assertSame( 10.0, $run['battery_drop_points'] );
		$this->assertSame( 10.0, $run['drain_rate_session_pct_per_hour'] );
		$this->assertSame( 10.4, $run['drain_rate_10min_pct_per_hour'] );
		$this->assertSame( 36000, $run['projected_full_runtime_seconds'] );
		$this->assertSame( 2, $run['reading_count'] );
		$this->assertSame( 'https://example.test/wp-admin/admin.php?page=bsbench-session&bsbenchSessionId=12', $run['report_url'] );
	}

	/**
	 * Stored UTC timestamps read as ISO 8601 in the site's timezone.
	 */
	public function test_dates_are_iso_8601_in_the_sites_timezone(): void {
		$this->session( 12, $this->finished_duration_meta() );

		$run = $this->reader()->find( 12 );

		$this->assertSame( '2026-11-24T10:30:00+01:00', $run['started_at'] );
		$this->assertSame( '2026-11-24T11:30:00+01:00', $run['ended_at'] );
	}

	/**
	 * A date that is empty or unreadable reads as null rather than a wrong moment.
	 */
	public function test_an_empty_or_unreadable_date_reads_as_null(): void {
		$this->session(
			1,
			array(
				'started_at' => '',
				'ended_at'   => 'not a date',
			)
		);

		$run = $this->reader()->find( 1 );

		$this->assertNull( $run['started_at'] );
		$this->assertNull( $run['ended_at'] );
	}

	/**
	 * A stored zero marks a figure the run couldn't measure; an agent sees null.
	 */
	public function test_a_stored_zero_reads_as_null(): void {
		$meta                  = $this->finished_duration_meta();
		$meta['rate_session']  = 0;
		$meta['rate_10']       = 0.0;
		$meta['time_to_empty'] = 0;
		$this->session( 3, $meta );

		$run = $this->reader()->find( 3 );

		$this->assertNull( $run['drain_rate_session_pct_per_hour'] );
		$this->assertNull( $run['drain_rate_10min_pct_per_hour'] );
		$this->assertNull( $run['projected_full_runtime_seconds'] );
	}

	/**
	 * A duration run's setup carries its length and no target.
	 */
	public function test_setup_of_a_duration_run_carries_its_length(): void {
		$this->session( 4, $this->finished_duration_meta() );

		$this->assertSame(
			array(
				'mode'                    => 'duration',
				'duration_seconds'        => 3600,
				'stop_at_battery_percent' => null,
			),
			$this->reader()->find( 4 )['setup']
		);
	}

	/**
	 * A target-drop run's setup carries its target and no length, even when a
	 * stray duration was stored.
	 */
	public function test_setup_of_a_target_drop_run_carries_its_target(): void {
		$this->session(
			5,
			array(
				'status'                => 'finished',
				'mode'                  => 'target',
				'config_mode'           => 'targetDrop',
				'config_target_percent' => 70,
				'config_duration'       => 0,
			)
		);

		$run = $this->reader()->find( 5 );

		$this->assertSame(
			array(
				'mode'                    => 'targetDrop',
				'duration_seconds'        => null,
				'stop_at_battery_percent' => 70,
			),
			$run['setup']
		);
		$this->assertSame( 'targetDrop', $run['end_reason'] );
		$this->assertSame( 'Finished: the battery fell to the level the run was set to stop at.', $run['outcome'] );
	}

	/**
	 * A setup figure the run never stored reads as null, not zero.
	 */
	public function test_a_setup_figure_that_was_never_stored_is_null(): void {
		$this->session(
			6,
			array(
				'status'      => 'finished',
				'config_mode' => 'duration',
			)
		);

		$this->assertNull( $this->reader()->find( 6 )['setup']['duration_seconds'] );
	}

	/**
	 * An empty browser field reads as null.
	 */
	public function test_empty_browser_fields_read_as_null(): void {
		$this->session(
			7,
			array(
				'ua_browser' => 'Chrome',
				'ua_version' => '',
				'ua_os'      => '',
			)
		);

		$this->assertSame(
			array(
				'name'    => 'Chrome',
				'version' => null,
				'os'      => null,
			),
			$this->reader()->find( 7 )['browser']
		);
	}

	/**
	 * Each way a run can end has its own sentence.
	 */
	public function test_every_status_has_its_outcome_sentence(): void {
		$this->session( 1, array( 'status' => 'stopped' ) );
		$this->session( 2, array( 'status' => 'aborted' ) );
		$this->session( 3, array( 'status' => 'failed' ) );

		$reader = $this->reader();

		$this->assertSame( 'stopped', $reader->find( 1 )['end_reason'] );
		$this->assertSame( 'Cut short: it was stopped by hand before it finished.', $reader->find( 1 )['outcome'] );
		$this->assertSame( 'plugged', $reader->find( 2 )['end_reason'] );
		$this->assertSame( 'Cut short: a charger was plugged in, which ended the run.', $reader->find( 2 )['outcome'] );
		$this->assertSame( 'loadError', $reader->find( 3 )['end_reason'] );
		$this->assertSame( "Failed: a course page didn't load, so the run stopped.", $reader->find( 3 )['outcome'] );
	}

	/**
	 * A run that hasn't reported its end has no end reason, and says so.
	 */
	public function test_a_running_run_has_no_end_reason(): void {
		$this->session( 8, array( 'status' => 'running' ) );

		$run = $this->reader()->find( 8 );

		$this->assertNull( $run['end_reason'] );
		$this->assertSame( "Still in progress: the run hasn't reported its end yet.", $run['outcome'] );
	}

	/**
	 * Only a published session of the session type is a run.
	 */
	public function test_find_refuses_other_post_types_other_statuses_and_unknown_ids(): void {
		$this->session( 1, array(), 'publish', 'page' );
		$this->session( 2, array(), 'trash' );
		$this->session( 3, array(), 'draft' );

		$reader = $this->reader();

		$this->assertNull( $reader->find( 1 ) );
		$this->assertNull( $reader->find( 2 ) );
		$this->assertNull( $reader->find( 3 ) );
		$this->assertNull( $reader->find( 404 ) );
	}

	/**
	 * Readings come back in stored order, with seconds and percent.
	 */
	public function test_readings_convert_milliseconds_and_levels(): void {
		$this->session( 12, $this->finished_duration_meta() );

		$this->assertSame(
			array(
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
			),
			$this->reader()->readings( 12 )
		);
	}

	/**
	 * A session with no stored readings has none to return.
	 */
	public function test_readings_of_a_run_without_samples_are_empty(): void {
		$this->session( 1, array( 'status' => 'failed' ) );

		$this->assertSame( array(), $this->reader()->readings( 1 ) );
	}

	/**
	 * Every published session is read, not just the first page: it pages through
	 * `get_posts()` in pages of 100 until one comes back short.
	 */
	public function test_all_reads_every_published_session_page_by_page(): void {
		for ( $id = 1; $id <= 250; $id++ ) {
			$this->session( $id );
		}

		$this->session( 900, array(), 'publish', 'page' );
		$this->session( 901, array(), 'trash' );

		$runs = $this->reader()->all();

		$this->assertCount( 250, $runs );
		$this->assertSame( 1, $runs[0]['id'] );
		$this->assertSame( 250, $runs[249]['id'] );
		$this->assertCount( 3, $this->queries );
		$this->assertSame( array( 1, 2, 3 ), array_column( $this->queries, 'paged' ) );

		foreach ( $this->queries as $query ) {
			$this->assertSame( 100, $query['posts_per_page'] );
			$this->assertSame( 'publish', $query['post_status'] );
			$this->assertSame( 'bsbench_session', $query['post_type'] );
		}
	}

	/**
	 * When the sessions fill whole pages exactly, the empty page that follows
	 * ends the read.
	 */
	public function test_all_stops_after_an_empty_page(): void {
		for ( $id = 1; $id <= 100; $id++ ) {
			$this->session( $id );
		}

		$this->assertCount( 100, $this->reader()->all() );
		$this->assertCount( 2, $this->queries );
	}

	/**
	 * With no sessions there are no runs.
	 */
	public function test_all_is_empty_when_nothing_is_recorded(): void {
		$this->assertSame( array(), $this->reader()->all() );
	}

	/**
	 * The newest run is the one that started last.
	 */
	public function test_newest_is_the_run_that_started_last(): void {
		$this->session( 1, array( 'started_at' => '2026-11-20T09:00:00.000Z' ) );
		$this->session( 2, array( 'started_at' => '2026-11-22T09:00:00.000Z' ) );
		$this->session( 3, array( 'started_at' => '2026-11-21T09:00:00.000Z' ) );

		$this->assertSame( 2, $this->reader()->newest()['id'] );
	}

	/**
	 * Runs that started at the same moment tie to the higher id.
	 */
	public function test_newest_breaks_a_tie_by_the_higher_id(): void {
		$this->session( 1, array( 'started_at' => '2026-11-20T09:00:00.000Z' ) );
		$this->session( 2, array( 'started_at' => '2026-11-20T09:00:00.000Z' ) );

		$this->assertSame( 2, $this->reader()->newest()['id'] );
	}

	/**
	 * A run with no start loses to one that has it.
	 */
	public function test_newest_ignores_a_run_with_no_start_when_another_has_one(): void {
		$this->session( 5, array( 'started_at' => '' ) );
		$this->session( 2, array( 'started_at' => '2026-11-20T09:00:00.000Z' ) );

		$this->assertSame( 2, $this->reader()->newest()['id'] );
	}

	/**
	 * With no runs there is no newest one.
	 */
	public function test_newest_is_null_when_nothing_is_recorded(): void {
		$this->assertNull( $this->reader()->newest() );
	}
}
