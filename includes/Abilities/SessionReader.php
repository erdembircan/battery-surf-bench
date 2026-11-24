<?php
/**
 * Benchmark session reader for the AI agent abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use ErdemBircan\BatterySurfBench\Content\RunOutcome;
use WP_Post;

use function __;
use function admin_url;
use function count;
use function get_post;
use function get_post_meta;
use function get_posts;
use function is_array;
use function is_string;
use function round;
use function strtotime;
use function wp_date;

defined( 'ABSPATH' ) || exit;

/**
 * Reads the published benchmark sessions as normalized runs: the shape every
 * read ability returns, with the stored meta turned into figures an agent can
 * reason about (percentages instead of 0..1 fractions, nulls instead of the
 * zero a run stores for a figure it couldn't measure, ISO 8601 dates in the
 * site's timezone, and a sentence saying how the run ended).
 *
 * Sessions are read through `get_posts()` in pages of 100 and filtered and
 * sorted in PHP by {@see RunFilter}, never through a meta query.
 */
class SessionReader {

	/**
	 * How many sessions each `get_posts()` page holds.
	 *
	 * @var int
	 */
	private const PAGE_SIZE = 100;

	/**
	 * Stores the post type and meta prefix the sessions are stored under, and
	 * where a run's report lives in wp-admin.
	 *
	 * @param string $post_type    Post type sessions are stored as.
	 * @param string $meta_prefix  Prefix every session meta key carries.
	 * @param string $detail_slug  Slug of the admin page that shows one session.
	 * @param string $detail_param URL parameter carrying the session id on that page.
	 */
	public function __construct(
		private string $post_type,
		private string $meta_prefix,
		private string $detail_slug,
		private string $detail_param
	) {
	}

	/**
	 * Reads every session with a post status as a normalized run, unsorted.
	 *
	 * @param string $status The post status to read: `publish` for the recorded runs, `trash` for the trashed ones.
	 * @return array<int, array<string, mixed>> The runs.
	 */
	public function all( string $status = 'publish' ): array {
		$runs    = array();
		$page    = 1;
		$fetched = 0;

		do {
			$ids = get_posts(
				array(
					'post_type'      => $this->post_type,
					'post_status'    => $status,
					'posts_per_page' => self::PAGE_SIZE,
					'paged'          => $page,
					'orderby'        => 'ID',
					'order'          => 'ASC',
					'fields'         => 'ids',
					'no_found_rows'  => true,
				)
			);

			foreach ( $ids as $id ) {
				$runs[] = $this->normalize( (int) $id );
			}

			$fetched = count( $ids );

			++$page;
		} while ( $fetched >= self::PAGE_SIZE );

		return $runs;
	}

	/**
	 * Finds one published session as a normalized run.
	 *
	 * @param int $id The session post id.
	 * @return array<string, mixed>|null The run, or null when the id isn't a published session.
	 */
	public function find( int $id ): ?array {
		return $this->find_with_status( $id, 'publish' );
	}

	/**
	 * Finds one trashed session as a normalized run.
	 *
	 * @param int $id The session post id.
	 * @return array<string, mixed>|null The run, or null when the id isn't a session in the trash.
	 */
	public function find_trashed( int $id ): ?array {
		return $this->find_with_status( $id, 'trash' );
	}

	/**
	 * Reads the readings a session recorded, in stored order.
	 *
	 * @param int $id The session post id.
	 * @return array<int, array{elapsed_seconds: float, battery_percent: float, charging: bool, repeat_count: int}> The readings.
	 */
	public function readings( int $id ): array {
		$stored = $this->meta( $id, 'samples' );

		if ( ! is_array( $stored ) ) {
			return array();
		}

		$readings = array();

		foreach ( $stored as $sample ) {
			if ( ! is_array( $sample ) ) {
				continue;
			}

			$readings[] = array(
				'elapsed_seconds' => round( (float) ( $sample['t'] ?? 0 ) / 1000, 1 ),
				'battery_percent' => round( (float) ( $sample['level'] ?? 0 ) * 100, 2 ),
				'charging'        => (bool) ( $sample['charging'] ?? false ),
				'repeat_count'    => (int) ( $sample['count'] ?? 1 ),
			);
		}

		return $readings;
	}

	/**
	 * Finds the run that started most recently.
	 *
	 * @return array<string, mixed>|null The newest run (the higher id on a tie), or null when none is recorded.
	 */
	public function newest(): ?array {
		$newest       = null;
		$newest_start = 0;

		foreach ( $this->all() as $run ) {
			$start = null === $run['started_at'] ? 0 : (int) strtotime( $run['started_at'] );

			if ( null === $newest || $start > $newest_start || ( $start === $newest_start && $run['id'] > $newest['id'] ) ) {
				$newest       = $run;
				$newest_start = $start;
			}
		}

		return $newest;
	}

	/**
	 * Finds a session with a given post status as a normalized run.
	 *
	 * @param int    $id     The session post id.
	 * @param string $status The post status the session must have.
	 * @return array<string, mixed>|null The run, or null when the id isn't a session with that status.
	 */
	private function find_with_status( int $id, string $status ): ?array {
		$post = get_post( $id );

		if ( ! $post instanceof WP_Post || $this->post_type !== $post->post_type || $status !== $post->post_status ) {
			return null;
		}

		return $this->normalize( $id );
	}

	/**
	 * Builds the normalized run for a session post.
	 *
	 * @param int $id The session post id.
	 * @return array<string, mixed> The run.
	 */
	private function normalize( int $id ): array {
		$status      = (string) $this->meta( $id, 'status' );
		$config_mode = (string) $this->meta( $id, 'config_mode' );
		$end_reason  = 'running' === $status ? null : RunOutcome::reason( $status, $config_mode );
		$samples     = $this->meta( $id, 'samples' );

		return array(
			'id'                              => $id,
			'status'                          => $status,
			'end_reason'                      => $end_reason,
			'outcome'                         => $this->outcome( $end_reason ),
			'mode'                            => (string) $this->meta( $id, 'mode' ),
			'started_at'                      => $this->date( $this->meta( $id, 'started_at' ) ),
			'ended_at'                        => $this->date( $this->meta( $id, 'ended_at' ) ),
			'elapsed_seconds'                 => (int) $this->meta( $id, 'elapsed' ),
			'battery_start_percent'           => round( (float) $this->meta( $id, 'start_level' ) * 100, 2 ),
			'battery_end_percent'             => round( (float) $this->meta( $id, 'end_level' ) * 100, 2 ),
			'battery_drop_points'             => round( (float) $this->meta( $id, 'dropped_pct' ), 2 ),
			'drain_rate_session_pct_per_hour' => $this->positive_float( $this->meta( $id, 'rate_session' ) ),
			'drain_rate_10min_pct_per_hour'   => $this->positive_float( $this->meta( $id, 'rate_10' ) ),
			'projected_full_runtime_seconds'  => $this->positive_int( $this->meta( $id, 'time_to_empty' ) ),
			'setup'                           => array(
				'duration_seconds'        => 'duration' === $config_mode ? $this->stored_int( $this->meta( $id, 'config_duration' ) ) : null,
				'stop_at_battery_percent' => 'targetDrop' === $config_mode ? $this->stored_int( $this->meta( $id, 'config_target_percent' ) ) : null,
			),
			'browser'                         => array(
				'name'    => $this->text_or_null( $this->meta( $id, 'ua_browser' ) ),
				'version' => $this->text_or_null( $this->meta( $id, 'ua_version' ) ),
				'os'      => $this->text_or_null( $this->meta( $id, 'ua_os' ) ),
			),
			'reading_count'                   => is_array( $samples ) ? count( $samples ) : 0,
			'report_url'                      => admin_url( 'admin.php?page=' . $this->detail_slug . '&' . $this->detail_param . '=' . $id ),
		);
	}

	/**
	 * Words how a run ended.
	 *
	 * @param string|null $end_reason The run-end reason key, or null while the run is still in progress.
	 * @return string The outcome sentence.
	 */
	private function outcome( ?string $end_reason ): string {
		return match ( $end_reason ) {
			'duration'   => __( 'Finished: it ran for its full set duration.', 'battery-surf-bench' ),
			'targetDrop' => __( 'Finished: the battery fell to the level the run was set to stop at.', 'battery-surf-bench' ),
			'stopped'    => __( 'Cut short: it was stopped by hand before it finished.', 'battery-surf-bench' ),
			'plugged'    => __( 'Cut short: a charger was plugged in, which ended the run.', 'battery-surf-bench' ),
			'loadError'  => __( "Failed: a course page didn't load, so the run stopped.", 'battery-surf-bench' ),
			default      => __( "Still in progress: the run hasn't reported its end yet.", 'battery-surf-bench' ),
		};
	}

	/**
	 * Reads a single session meta value by its bare field name.
	 *
	 * @param int    $id    The session post id.
	 * @param string $field Bare field name (e.g. `status`).
	 * @return mixed The stored meta value.
	 */
	private function meta( int $id, string $field ): mixed {
		return get_post_meta( $id, $this->meta_prefix . $field, true );
	}

	/**
	 * Formats a stored UTC timestamp as ISO 8601 in the site's timezone.
	 *
	 * @param mixed $stored The stored timestamp string.
	 * @return string|null The formatted date, or null when the meta is empty or unparseable.
	 */
	private function date( mixed $stored ): ?string {
		if ( ! is_string( $stored ) || '' === $stored ) {
			return null;
		}

		$timestamp = strtotime( $stored );

		if ( false === $timestamp ) {
			return null;
		}

		return wp_date( 'c', $timestamp );
	}

	/**
	 * Turns a stored figure into a float, or null when it isn't positive: the
	 * marker a run stored for a rate it could not measure.
	 *
	 * @param mixed $stored The stored figure.
	 * @return float|null The figure, or null.
	 */
	private function positive_float( mixed $stored ): ?float {
		$value = (float) $stored;

		return $value > 0 ? $value : null;
	}

	/**
	 * Turns a stored figure into an integer, or null when it isn't positive.
	 *
	 * @param mixed $stored The stored figure.
	 * @return int|null The figure, or null.
	 */
	private function positive_int( mixed $stored ): ?int {
		$value = (int) $stored;

		return $value > 0 ? $value : null;
	}

	/**
	 * Turns a stored setup figure into an integer, or null when the run never
	 * stored one.
	 *
	 * @param mixed $stored The stored figure.
	 * @return int|null The figure, or null when the meta is empty.
	 */
	private function stored_int( mixed $stored ): ?int {
		return '' === $stored || null === $stored ? null : (int) $stored;
	}

	/**
	 * Turns a stored text into a string, or null when it is empty.
	 *
	 * @param mixed $stored The stored text.
	 * @return string|null The text, or null when empty.
	 */
	private function text_or_null( mixed $stored ): ?string {
		$text = (string) $stored;

		return '' === $text ? null : $text;
	}
}
