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
use WP_Post;

/**
 * Behavioral tests for reading stored sessions as normalized runs: the figures
 * an agent sees, the paging that reads every session with a status, and the
 * checks that keep other posts out.
 */
final class SessionReaderTest extends AbilityTestCase {

	/**
	 * Sessions the stubs serve: id => type, status and meta.
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
	 * The `update_meta_cache()` calls, in call order: type and ids.
	 *
	 * @var array<int, array{0: string, 1: array<int, int>}>
	 */
	private array $meta_cache = array();

	/** Stubs the WordPress functions the reader calls, backed by `$posts`. */
	protected function setUp(): void {
		parent::setUp();

		$this->posts      = array();
		$this->queries    = array();
		$this->meta_cache = array();

		Functions\when( 'update_meta_cache' )->alias(
			function ( string $type, array $ids ): void {
				$this->meta_cache[] = array( $type, $ids );
			}
		);

		Functions\when( 'get_posts' )->alias(
			function ( array $args ): array {
				$this->queries[] = $args;
				$ids             = array_keys(
					array_filter(
						$this->posts,
						static fn ( array $post ): bool => $post['type'] === $args['post_type'] && $post['status'] === $args['post_status']
					)
				);

				return array_slice( $ids, ( $args['paged'] - 1 ) * $args['posts_per_page'], $args['posts_per_page'] );
			}
		);
		Functions\when( 'get_post' )->alias(
			fn ( int $id ) => isset( $this->posts[ $id ] )
				? new WP_Post(
					(object) array(
						'ID'          => $id,
						'post_type'   => $this->posts[ $id ]['type'],
						'post_status' => $this->posts[ $id ]['status'],
					)
				)
				: null
		);
		Functions\when( 'get_post_meta' )->alias( fn ( int $id, string $key ) => $this->posts[ $id ]['meta'][ $key ] ?? '' );
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
	 * Stores a session; named arguments are its meta under their bare names.
	 *
	 * @param int    $id          The session id.
	 * @param string $post_status The post status.
	 * @param string $post_type   The post type.
	 * @param mixed  ...$meta     Meta values, by bare field name.
	 */
	private function session( int $id, string $post_status = 'publish', string $post_type = 'bsbench_session', mixed ...$meta ): void {
		$this->posts[ $id ] = array(
			'type'   => $post_type,
			'status' => $post_status,
			'meta'   => array_combine( array_map( static fn ( string $field ): string => 'bsbench_' . $field, array_keys( $meta ) ), $meta ),
		);
	}

	/**
	 * Stores a finished duration run as the cockpit saves it.
	 *
	 * @param int $id The session id.
	 */
	private function finished_run( int $id ): void {
		$this->session(
			$id,
			status: 'finished',
			mode: 'duration',
			config_mode: 'duration',
			config_duration: 3600,
			started_at: '2026-11-24T09:30:00.000Z',
			ended_at: '2026-11-24T10:30:00.000Z',
			start_level: 0.98,
			end_level: 0.88,
			dropped_pct: 10.0,
			elapsed: 3600,
			rate_session: 10.0,
			rate_10: 10.4,
			time_to_empty: 36000,
			ua_browser: 'Chrome',
			ua_version: '142',
			ua_os: 'macOS',
			samples: array(
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
			)
		);
	}

	/** A stored run reads as the figures an agent can reason about, in a fixed key order, with dates in the site's timezone. */
	public function test_find_normalizes_a_finished_duration_run(): void {
		$this->finished_run( 12 );

		$run = $this->reader()->find( 12 );

		$this->assertSame( array_keys( RunFixture::run() ), array_keys( $run ) );
		$this->assertSame( 'duration', $run['end_reason'] );
		$this->assertSame( 'Finished: it ran for its full set duration.', $run['outcome'] );
		$this->assertSame( '2026-11-24T10:30:00+01:00', $run['started_at'] );
		$this->assertSame( '2026-11-24T11:30:00+01:00', $run['ended_at'] );
		$this->assertSame( array( 98.0, 88.0, 10.0 ), array( $run['battery_start_percent'], $run['battery_end_percent'], $run['battery_drop_points'] ) );
		$this->assertSame( array( 10.0, 10.4, 36000 ), array( $run['drain_rate_session_pct_per_hour'], $run['drain_rate_10min_pct_per_hour'], $run['projected_full_runtime_seconds'] ) );
		$this->assertSame( array( 3600, 2 ), array( $run['elapsed_seconds'], $run['reading_count'] ) );
		$this->assertSame( 'https://example.test/wp-admin/admin.php?page=bsbench-session&bsbenchSessionId=12', $run['report_url'] );
		$this->assertSame(
			array(
				'name'    => 'Chrome',
				'version' => '142',
				'os'      => 'macOS',
			),
			$run['browser']
		);
	}

	/** A stored zero marks a figure the run couldn't measure, an empty date or browser field is nothing: an agent sees null. */
	public function test_zeros_and_empty_fields_read_as_null(): void {
		$this->session( 3, rate_session: 0, rate_10: 0.0, time_to_empty: 0, started_at: '', ended_at: 'not a date', ua_browser: 'Chrome', ua_version: '', ua_os: '' );

		$run = $this->reader()->find( 3 );

		$this->assertSame( array( null, null, null ), array( $run['drain_rate_session_pct_per_hour'], $run['drain_rate_10min_pct_per_hour'], $run['projected_full_runtime_seconds'] ) );
		$this->assertSame( array( null, null ), array( $run['started_at'], $run['ended_at'] ) );
		$this->assertSame( 'Chrome', $run['browser']['name'] );
		$this->assertNull( $run['browser']['version'] );
		$this->assertNull( $run['browser']['os'] );
	}

	/** The setup carries only the goal the run was set with: its length, or its target; a figure never stored is null. */
	public function test_setup_carries_only_the_goal_the_run_was_set_with(): void {
		$this->finished_run( 4 );
		$this->session( 5, status: 'finished', mode: 'target', config_mode: 'targetDrop', config_target_percent: 70, config_duration: 0 );
		$this->session( 6, status: 'finished', config_mode: 'duration' );

		$reader = $this->reader();

		$this->assertSame( array( 'duration_seconds', 'stop_at_battery_percent' ), array_keys( $reader->find( 4 )['setup'] ) );
		$this->assertSame( array( 3600, null ), array_values( $reader->find( 4 )['setup'] ) );
		$this->assertSame( array( null, 70 ), array_values( $reader->find( 5 )['setup'] ) );
		$this->assertSame( 'targetDrop', $reader->find( 5 )['end_reason'] );
		$this->assertSame( 'Finished: the battery fell to the level the run was set to stop at.', $reader->find( 5 )['outcome'] );
		$this->assertNull( $reader->find( 6 )['setup']['duration_seconds'] );
	}

	/** Each way a run can end has its own reason and sentence, and a run still going has no reason. */
	public function test_every_status_has_its_reason_and_outcome_sentence(): void {
		$this->session( 1, status: 'stopped' );
		$this->session( 2, status: 'aborted' );
		$this->session( 3, status: 'failed' );
		$this->session( 4, status: 'running' );

		$reader = $this->reader();
		$cases  = array(
			array( 1, 'stopped', 'Cut short: it was stopped by hand before it finished.' ),
			array( 2, 'plugged', 'Cut short: a charger was plugged in, which ended the run.' ),
			array( 3, 'loadError', "Failed: a course page didn't load, so the run stopped." ),
			array( 4, null, "Still in progress: the run hasn't reported its end yet." ),
		);

		foreach ( $cases as list( $id, $reason, $outcome ) ) {
			$this->assertSame( array( $reason, $outcome ), array( $reader->find( $id )['end_reason'], $reader->find( $id )['outcome'] ) );
		}
	}

	/** Only a published session of the session type is a run; only a trashed one is a trashed run. */
	public function test_find_and_find_trashed_keep_other_posts_out(): void {
		$this->session( 1, post_type: 'page' );
		$this->session( 2, 'trash' );
		$this->session( 3, 'draft' );
		$this->session( 4 );
		$this->session( 5, 'trash', 'page' );

		$reader = $this->reader();

		foreach ( array( 1, 2, 3, 404 ) as $id ) {
			$this->assertNull( $reader->find( $id ), (string) $id );
		}

		$this->assertSame( 4, $reader->find( 4 )['id'] );
		$this->assertSame( 2, $reader->find_trashed( 2 )['id'] );

		foreach ( array( 1, 3, 4, 5, 404 ) as $id ) {
			$this->assertNull( $reader->find_trashed( $id ), (string) $id );
		}
	}

	/** Readings come back in stored order, as seconds and percent; a run without samples has none. */
	public function test_readings_convert_milliseconds_and_levels(): void {
		$this->finished_run( 12 );
		$this->session( 1, status: 'failed' );

		$this->assertSame( array( 0.0, 360.0 ), array_column( $this->reader()->readings( 12 ), 'elapsed_seconds' ) );
		$this->assertSame( array( 98.0, 97.0 ), array_column( $this->reader()->readings( 12 ), 'battery_percent' ) );
		$this->assertSame( array( 3, 3 ), array_column( $this->reader()->readings( 12 ), 'repeat_count' ) );
		$this->assertSame( array( false, false ), array_column( $this->reader()->readings( 12 ), 'charging' ) );
		$this->assertSame( array(), $this->reader()->readings( 1 ) );
	}

	/** Every session is read, not just the first page: `get_posts()` is paged in hundreds until one is short; the trash reads the same way. */
	public function test_all_reads_every_session_with_the_status_page_by_page(): void {
		for ( $id = 1; $id <= 250; $id++ ) {
			$this->session( $id );
		}

		$this->session( 900, post_type: 'page' );
		$this->session( 901, 'trash' );

		$runs = $this->reader()->all();

		$this->assertCount( 250, $runs );
		$this->assertSame( array( 1, 250 ), array( $runs[0]['id'], $runs[249]['id'] ) );
		$this->assertSame( array( 1, 2, 3 ), array_column( $this->queries, 'paged' ) );
		$this->assertSame( array( 100 ), array_unique( array_column( $this->queries, 'posts_per_page' ) ) );
		$this->assertSame(
			array(
				array( 'post', range( 1, 100 ) ),
				array( 'post', range( 101, 200 ) ),
				array( 'post', range( 201, 250 ) ),
			),
			$this->meta_cache
		);
		$this->assertSame( array( 901 ), array_column( $this->reader()->all( 'trash' ), 'id' ) );
		$this->assertSame( 'trash', end( $this->queries )['post_status'] );
	}

	/** When the sessions fill whole pages exactly, the empty page that follows ends the read; with none there are no runs. */
	public function test_all_stops_after_an_empty_page(): void {
		$this->assertSame( array(), $this->reader()->all() );

		for ( $id = 1; $id <= 100; $id++ ) {
			$this->session( $id );
		}

		$this->queries = array();

		$this->assertCount( 100, $this->reader()->all() );
		$this->assertCount( 2, $this->queries );
	}

	/** The newest run started last; a tie goes to the higher id, a run with no start loses, and none means null. */
	public function test_newest_is_the_run_that_started_last(): void {
		$this->assertNull( $this->reader()->newest() );

		$this->session( 1, started_at: '2026-11-20T09:00:00.000Z' );
		$this->session( 2, started_at: '2026-11-22T09:00:00.000Z' );
		$this->session( 3, started_at: '2026-11-21T09:00:00.000Z' );
		$this->session( 5, started_at: '' );

		$this->assertSame( 2, $this->reader()->newest()['id'] );

		$this->session( 6, started_at: '2026-11-22T09:00:00.000Z' );

		$this->assertSame( 6, $this->reader()->newest()['id'] );
	}
}
