<?php
/**
 * Benchmark run filtering and sorting.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use DateTimeImmutable;
use WP_Error;

use function __;
use function array_filter;
use function array_map;
use function array_values;
use function explode;
use function in_array;
use function is_array;
use function is_string;
use function preg_match;
use function rest_parse_date;
use function sprintf;
use function stripos;
use function strtotime;
use function usort;
use function wp_timezone;

defined( 'ABSPATH' ) || exit;

/**
 * Narrows normalized runs (see {@see SessionReader}) to the ones that match a
 * set of criteria, and sorts them. It works on arrays in memory rather than
 * through a database query, so the same rules hold however many runs there
 * are, and a run's null figures are handled in one place: a run with no value
 * for the field being sorted always comes last.
 */
class RunFilter {

	/**
	 * The sort fields an agent may choose, mapped to the normalized run key each
	 * one reads.
	 *
	 * @var array<string, string>
	 */
	private const SORT_KEYS = array(
		'drain_rate_session' => 'drain_rate_session_pct_per_hour',
		'drain_rate_10min'   => 'drain_rate_10min_pct_per_hour',
		'battery_drop'       => 'battery_drop_points',
		'elapsed'            => 'elapsed_seconds',
		'projected_runtime'  => 'projected_full_runtime_seconds',
	);

	/**
	 * Keeps the runs that match every criterion given.
	 *
	 * @param array<int, array<string, mixed>> $runs  The normalized runs.
	 * @param array<string, mixed>             $input The criteria: `status` and `mode` (lists), `browser` and `os` (case-insensitive text), `started_after` and `started_before` (dates).
	 * @return array<int, array<string, mixed>>|WP_Error The matching runs, or an error when a date can't be read.
	 */
	public function filter( array $runs, array $input ): array|WP_Error {
		$after  = $this->boundary( $input, 'started_after' );
		$before = $this->boundary( $input, 'started_before' );

		if ( $after instanceof WP_Error ) {
			return $after;
		}

		if ( $before instanceof WP_Error ) {
			return $before;
		}

		$statuses = $this->list_of( $input['status'] ?? null );
		$modes    = $this->list_of( $input['mode'] ?? null );
		$browser  = isset( $input['browser'] ) ? (string) $input['browser'] : '';
		$os       = isset( $input['os'] ) ? (string) $input['os'] : '';

		$matching = array_filter(
			$runs,
			function ( array $run ) use ( $statuses, $modes, $browser, $os, $after, $before ): bool {
				return $this->in_list( $run['status'], $statuses )
					&& $this->in_list( $run['mode'], $modes )
					&& $this->contains( $run['browser']['name'], $browser )
					&& $this->contains( $run['browser']['os'], $os )
					&& $this->within( $run, $after, $before );
			}
		);

		return array_values( $matching );
	}

	/**
	 * Sorts runs by a field, with the runs that have no value for it last in
	 * either direction. Ties keep the higher id first when descending and the
	 * lower id first when ascending.
	 *
	 * @param array<int, array<string, mixed>> $runs     The normalized runs.
	 * @param string                           $order_by The sort field: `started_at`, `drain_rate_session`, `drain_rate_10min`, `battery_drop`, `elapsed` or `projected_runtime`.
	 * @param string                           $order    The direction: `asc` or `desc`.
	 * @return array<int, array<string, mixed>> The sorted runs.
	 */
	public function sort( array $runs, string $order_by, string $order ): array {
		$descending = 'asc' !== $order;
		$sorted     = array_values( $runs );

		usort(
			$sorted,
			function ( array $a, array $b ) use ( $order_by, $descending ): int {
				$left  = $this->sort_value( $a, $order_by );
				$right = $this->sort_value( $b, $order_by );

				if ( null === $left && null === $right ) {
					return $this->by_id( $a, $b, $descending );
				}

				if ( null === $left ) {
					return 1;
				}

				if ( null === $right ) {
					return -1;
				}

				$comparison = $descending ? $right <=> $left : $left <=> $right;

				return 0 === $comparison ? $this->by_id( $a, $b, $descending ) : $comparison;
			}
		);

		return $sorted;
	}

	/**
	 * Reads a date as a moment: a bare date (`YYYY-MM-DD`) is midnight at the
	 * start of that day in the site's timezone; anything else must be an RFC 3339
	 * date and time with an offset.
	 *
	 * @param string $value The date text.
	 * @return int|WP_Error The Unix timestamp, or an error when the text isn't a date.
	 */
	public function parse_date( string $value ): int|WP_Error {
		if ( 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			$day = DateTimeImmutable::createFromFormat( '!Y-m-d', $value, wp_timezone() );

			if ( false !== $day && $day->format( 'Y-m-d' ) === $value ) {
				return $day->getTimestamp();
			}
		} elseif ( 1 === preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/', $value ) ) {
			// Core would also read a date and time with no offset, as UTC; the
			// documented forms always carry one, so anything else is refused.
			$timestamp = rest_parse_date( $value );

			if ( false !== $timestamp ) {
				return $timestamp;
			}
		}

		return new WP_Error(
			'bsbench_invalid_date',
			sprintf(
				/* translators: %s: The value that was given as a date. */
				__( '“%s” isn\'t a date the site can read. Use a date such as 2026-11-24, or a date and time with an offset, such as 2026-11-24T09:30:00+01:00.', 'battery-surf-bench' ),
				$value
			),
			array( 'status' => 400 )
		);
	}

	/**
	 * Reads one date criterion, when it is given.
	 *
	 * @param array<string, mixed> $input The criteria.
	 * @param string               $key   The criterion's key.
	 * @return int|WP_Error|null The timestamp, an error when it can't be read, or null when the criterion is absent.
	 */
	private function boundary( array $input, string $key ): int|WP_Error|null {
		if ( ! isset( $input[ $key ] ) || '' === $input[ $key ] ) {
			return null;
		}

		return $this->parse_date( (string) $input[ $key ] );
	}

	/**
	 * Turns a list criterion into a list of strings. A transport that delivers a
	 * list as one comma-separated string is read as the list it stands for.
	 *
	 * @param mixed $value The criterion as given.
	 * @return array<int, string> The list, empty when the criterion is absent.
	 */
	private function list_of( mixed $value ): array {
		if ( is_string( $value ) ) {
			$value = '' === $value ? array() : explode( ',', $value );
		}

		if ( ! is_array( $value ) ) {
			return array();
		}

		return array_map( 'strval', array_values( $value ) );
	}

	/**
	 * Whether a value is in a list criterion; an empty list matches everything.
	 *
	 * @param string             $value    The run's value.
	 * @param array<int, string> $accepted The accepted values.
	 * @return bool Whether the run passes the criterion.
	 */
	private function in_list( string $value, array $accepted ): bool {
		return array() === $accepted || in_array( $value, $accepted, true );
	}

	/**
	 * Whether a run's text contains the wanted text, ignoring case; an empty
	 * wanted text matches everything, and a run with no text never matches a
	 * wanted one.
	 *
	 * @param string|null $haystack The run's text.
	 * @param string      $needle   The wanted text.
	 * @return bool Whether the run passes the criterion.
	 */
	private function contains( ?string $haystack, string $needle ): bool {
		if ( '' === $needle ) {
			return true;
		}

		return null !== $haystack && false !== stripos( $haystack, $needle );
	}

	/**
	 * Whether a run started inside the date criteria. A run with no start never
	 * matches a date criterion.
	 *
	 * @param array<string, mixed> $run    The normalized run.
	 * @param int|null             $after  Earliest start (inclusive), or null for no limit.
	 * @param int|null             $before Latest start (exclusive), or null for no limit.
	 * @return bool Whether the run passes the criteria.
	 */
	private function within( array $run, ?int $after, ?int $before ): bool {
		if ( null === $after && null === $before ) {
			return true;
		}

		$start = $this->started( $run );

		if ( null === $start ) {
			return false;
		}

		return ( null === $after || $start >= $after ) && ( null === $before || $start < $before );
	}

	/**
	 * Reads a run's start as a timestamp.
	 *
	 * @param array<string, mixed> $run The normalized run.
	 * @return int|null The timestamp, or null when the run has no start.
	 */
	private function started( array $run ): ?int {
		if ( null === $run['started_at'] ) {
			return null;
		}

		$timestamp = strtotime( $run['started_at'] );

		return false === $timestamp ? null : $timestamp;
	}

	/**
	 * Reads the value a run is sorted by. A missing start counts as zero; a
	 * missing figure is null.
	 *
	 * @param array<string, mixed> $run      The normalized run.
	 * @param string               $order_by The sort field.
	 * @return float|int|null The sort value.
	 */
	private function sort_value( array $run, string $order_by ): float|int|null {
		if ( ! isset( self::SORT_KEYS[ $order_by ] ) ) {
			return $this->started( $run ) ?? 0;
		}

		return $run[ self::SORT_KEYS[ $order_by ] ];
	}

	/**
	 * Breaks a tie by id: the higher first when descending, the lower first when
	 * ascending.
	 *
	 * @param array<string, mixed> $a          The first run.
	 * @param array<string, mixed> $b          The second run.
	 * @param bool                 $descending Whether the sort runs newest or highest first.
	 * @return int The comparison result.
	 */
	private function by_id( array $a, array $b, bool $descending ): int {
		return $descending ? $b['id'] <=> $a['id'] : $a['id'] <=> $b['id'];
	}
}
