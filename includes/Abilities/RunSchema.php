<?php
/**
 * JSON schemas shared by the AI agent abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use function __;

defined( 'ABSPATH' ) || exit;

/**
 * The schema fragments more than one ability describes its input or output
 * with: the run shapes, a reading, the course, and the run filters.
 *
 * Built fresh on every call (never held in a constant) because the filter
 * descriptions are translated, and translating must wait until `init` has fired.
 */
final class RunSchema {

	/**
	 * The schema of a run as the list returns it: the run without its reading
	 * count.
	 *
	 * @return array<string, mixed> The schema.
	 */
	public static function summary(): array {
		$properties = self::run_properties();

		unset( $properties['reading_count'] );

		return array(
			'type'       => 'object',
			'properties' => $properties,
		);
	}

	/**
	 * The schema of a run in full.
	 *
	 * @return array<string, mixed> The schema.
	 */
	public static function detail(): array {
		return array(
			'type'       => 'object',
			'properties' => self::run_properties(),
		);
	}

	/**
	 * The schema of one battery reading.
	 *
	 * @return array<string, mixed> The schema.
	 */
	public static function reading(): array {
		return array(
			'type'       => 'object',
			'properties' => array(
				'elapsed_seconds' => array( 'type' => 'number' ),
				'battery_percent' => array( 'type' => 'number' ),
				'charging'        => array( 'type' => 'boolean' ),
				'repeat_count'    => array( 'type' => 'integer' ),
			),
		);
	}

	/**
	 * The schema of one page of the course as the abilities describe it.
	 *
	 * @return array<string, mixed> The schema.
	 */
	public static function course_page(): array {
		return array(
			'type'       => 'object',
			'properties' => array(
				'position'  => array( 'type' => 'integer' ),
				'kind'      => array(
					'type' => 'string',
					'enum' => array( 'bundled', 'user' ),
				),
				'slug'      => array( 'type' => array( 'string', 'null' ) ),
				'post_id'   => array( 'type' => array( 'integer', 'null' ) ),
				'title'     => array( 'type' => 'string' ),
				'post_type' => array( 'type' => array( 'string', 'null' ) ),
				'url'       => array( 'type' => array( 'string', 'null' ) ),
			),
		);
	}

	/**
	 * The output properties every course ability shares: the pages, how many
	 * there are, whether the course is the default, and the bundled pages.
	 *
	 * @return array<string, array<string, mixed>> The schema properties.
	 */
	public static function course(): array {
		return array(
			'pages'         => array(
				'type'  => 'array',
				'items' => self::course_page(),
			),
			'page_count'    => array( 'type' => 'integer' ),
			'is_default'    => array( 'type' => 'boolean' ),
			'bundled_pages' => array(
				'type'  => 'array',
				'items' => array(
					'type'       => 'object',
					'properties' => array(
						'slug'      => array( 'type' => 'string' ),
						'title'     => array( 'type' => 'string' ),
						'in_course' => array( 'type' => 'boolean' ),
					),
				),
			),
		);
	}

	/**
	 * The input properties the run filters share.
	 *
	 * @param bool $finished_by_default Whether the status filter defaults to finished runs, as it does when averaging.
	 * @return array<string, array<string, mixed>> The schema properties.
	 */
	public static function filters( bool $finished_by_default = false ): array {
		$status = array(
			'type'        => 'array',
			'items'       => array(
				'type' => 'string',
				'enum' => array( 'finished', 'stopped', 'aborted', 'failed', 'running' ),
			),
			'description' => $finished_by_default
				? __( 'Only runs with one of these statuses. finished: the run completed its set duration or reached its target level. stopped: stopped by hand. aborted: ended because a charger was plugged in. failed: a course page didn\'t load. running: hasn\'t reported its end. Defaults to finished runs only.', 'battery-surf-bench' )
				: __( 'Only runs with one of these statuses. finished: the run completed its set duration or reached its target level. stopped: stopped by hand. aborted: ended because a charger was plugged in. failed: a course page didn\'t load. running: hasn\'t reported its end.', 'battery-surf-bench' ),
		);

		if ( $finished_by_default ) {
			$status['default'] = array( 'finished' );
		}

		return array(
			'status'         => $status,
			'mode'           => array(
				'type'        => 'array',
				'items'       => array(
					'type' => 'string',
					'enum' => array( 'duration', 'target' ),
				),
				'description' => __( 'Only runs in one of these modes. duration: ran for a set length of time. target: ran until the battery fell to a set level.', 'battery-surf-bench' ),
			),
			'browser'        => array(
				'type'        => 'string',
				'description' => __( 'Only runs captured in a browser whose name contains this text, such as Chrome, Edge or Opera. Not case-sensitive.', 'battery-surf-bench' ),
			),
			'os'             => array(
				'type'        => 'string',
				'description' => __( 'Only runs captured on an operating system whose name contains this text, such as macOS or Windows. Not case-sensitive.', 'battery-surf-bench' ),
			),
			'started_after'  => array(
				'type'        => 'string',
				'description' => __( 'Only runs that started at or after this moment. A date (YYYY-MM-DD) means the start of that day in the site\'s timezone; a date and time needs an offset, such as 2026-11-24T09:30:00+01:00.', 'battery-surf-bench' ),
			),
			'started_before' => array(
				'type'        => 'string',
				'description' => __( 'Only runs that started before this moment. A date (YYYY-MM-DD) means the start of that day in the site\'s timezone, so that day itself is left out.', 'battery-surf-bench' ),
			),
		);
	}

	/**
	 * The properties of a run in full, in the order the runs list them.
	 *
	 * @return array<string, array<string, mixed>> The schema properties.
	 */
	private static function run_properties(): array {
		return array(
			'id'                              => array( 'type' => 'integer' ),
			'status'                          => array( 'type' => 'string' ),
			'end_reason'                      => array( 'type' => array( 'string', 'null' ) ),
			'outcome'                         => array( 'type' => 'string' ),
			'mode'                            => array( 'type' => 'string' ),
			'started_at'                      => array( 'type' => array( 'string', 'null' ) ),
			'ended_at'                        => array( 'type' => array( 'string', 'null' ) ),
			'elapsed_seconds'                 => array( 'type' => 'integer' ),
			'battery_start_percent'           => array( 'type' => 'number' ),
			'battery_end_percent'             => array( 'type' => 'number' ),
			'battery_drop_points'             => array( 'type' => 'number' ),
			'drain_rate_session_pct_per_hour' => array( 'type' => array( 'number', 'null' ) ),
			'drain_rate_10min_pct_per_hour'   => array( 'type' => array( 'number', 'null' ) ),
			'projected_full_runtime_seconds'  => array( 'type' => array( 'integer', 'null' ) ),
			'setup'                           => array(
				'type'       => 'object',
				'properties' => array(
					'duration_seconds'        => array( 'type' => array( 'integer', 'null' ) ),
					'stop_at_battery_percent' => array( 'type' => array( 'integer', 'null' ) ),
				),
			),
			'browser'                         => array(
				'type'       => 'object',
				'properties' => array(
					'name'    => array( 'type' => array( 'string', 'null' ) ),
					'version' => array( 'type' => array( 'string', 'null' ) ),
					'os'      => array( 'type' => array( 'string', 'null' ) ),
				),
			),
			'reading_count'                   => array( 'type' => 'integer' ),
			'report_url'                      => array( 'type' => 'string' ),
		);
	}
}
