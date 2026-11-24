<?php
/**
 * Normalized run fixture for the ability tests.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

/**
 * Builds a normalized run, the shape the session reader hands the abilities,
 * with any field overridden.
 */
final class RunFixture {

	/**
	 * Builds a finished, measured run.
	 *
	 * @param array<string, mixed> $overrides Fields to replace.
	 * @return array<string, mixed> The run.
	 */
	public static function run( array $overrides = array() ): array {
		$id = (int) ( $overrides['id'] ?? 1 );

		return array_merge(
			array(
				'id'                              => $id,
				'status'                          => 'finished',
				'end_reason'                      => 'duration',
				'outcome'                         => 'Finished: it ran for its full set duration.',
				'mode'                            => 'duration',
				'started_at'                      => '2026-11-20T10:00:00+01:00',
				'ended_at'                        => '2026-11-20T11:00:00+01:00',
				'elapsed_seconds'                 => 3600,
				'battery_start_percent'           => 98.0,
				'battery_end_percent'             => 88.0,
				'battery_drop_points'             => 10.0,
				'drain_rate_session_pct_per_hour' => 10.0,
				'drain_rate_10min_pct_per_hour'   => 10.4,
				'projected_full_runtime_seconds'  => 36000,
				'setup'                           => array(
					'duration_seconds'        => 3600,
					'stop_at_battery_percent' => null,
				),
				'browser'                         => array(
					'name'    => 'Chrome',
					'version' => '142',
					'os'      => 'macOS',
				),
				'reading_count'                   => 11,
				'report_url'                      => 'https://example.test/wp-admin/admin.php?page=bsbench-session&bsbenchSessionId=' . $id,
			),
			$overrides
		);
	}
}
