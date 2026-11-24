<?php
/**
 * The get-drain-stats ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function array_column;
use function array_filter;
use function array_map;
use function array_sum;
use function array_values;
use function count;
use function round;
use function wp_date;
use function wp_timezone_string;

defined( 'ABSPATH' ) || exit;

/**
 * Averages the drain figures over a set of benchmark runs.
 */
class GetDrainStats implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/get-drain-stats';

	/**
	 * The filters an agent may narrow the runs with.
	 *
	 * @var string[]
	 */
	private const FILTER_KEYS = array( 'status', 'mode', 'browser', 'os', 'started_after', 'started_before' );

	/**
	 * Stores the collaborators that read and narrow the runs.
	 *
	 * @param SessionReader $reader Reads the recorded runs.
	 * @param RunFilter     $filter Filters them.
	 */
	public function __construct(
		private SessionReader $reader,
		private RunFilter $filter
	) {
	}

	/**
	 * The ability's registered name.
	 *
	 * @return string The ability name.
	 */
	public function name(): string {
		return self::NAME;
	}

	/**
	 * Builds the ability's definition.
	 *
	 * @return array{label: string, description: string, input_schema: array<string, mixed>, output_schema: array<string, mixed>, annotations: array<string, bool>} The ability definition.
	 */
	public function definition(): array {
		$extreme = array(
			'type'       => array( 'object', 'null' ),
			'properties' => array(
				'id'                              => array( 'type' => 'integer' ),
				'drain_rate_session_pct_per_hour' => array( 'type' => 'number' ),
			),
		);

		return array(
			'label'         => __( 'Get drain statistics', 'battery-surf-bench' ),
			'description'   => __( 'Averages the drain figures over a set of benchmark runs: finished runs by default, or the statuses, modes, browsers, operating system and dates you filter by. Runs whose drain rate couldn\'t be measured are counted but left out of the averages, and their ids are listed. Also names the runs with the fastest and the slowest whole-run drain rate.', 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'properties'           => RunSchema::filters( true ),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'now'                         => array( 'type' => 'string' ),
					'timezone'                    => array( 'type' => 'string' ),
					'filters_applied'             => array( 'type' => 'object' ),
					'runs_matched'                => array( 'type' => 'integer' ),
					'runs_measured'               => array( 'type' => 'integer' ),
					'unmeasured_run_ids'          => array(
						'type'  => 'array',
						'items' => array( 'type' => 'integer' ),
					),
					'average_drain_rate_session_pct_per_hour' => array( 'type' => array( 'number', 'null' ) ),
					'average_drain_rate_10min_pct_per_hour' => array( 'type' => array( 'number', 'null' ) ),
					'average_projected_full_runtime_seconds' => array( 'type' => array( 'integer', 'null' ) ),
					'average_battery_drop_points' => array( 'type' => array( 'number', 'null' ) ),
					'total_elapsed_seconds'       => array( 'type' => 'integer' ),
					'fastest_drain'               => $extreme,
					'slowest_drain'               => $extreme,
				),
			),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Averages the drain figures over the runs that match the filters.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The statistics, or an error when a date filter can't be read.
	 */
	public function execute( array $input ): array|WP_Error {
		$applied = array();

		foreach ( self::FILTER_KEYS as $key ) {
			if ( isset( $input[ $key ] ) && array() !== $input[ $key ] && '' !== $input[ $key ] ) {
				$applied[ $key ] = $input[ $key ];
			}
		}

		if ( ! isset( $applied['status'] ) ) {
			$applied['status'] = array( 'finished' );
		}

		$matched = $this->filter->filter( $this->reader->all(), $applied );

		if ( $matched instanceof WP_Error ) {
			return $matched;
		}

		$measured   = array_values(
			array_filter(
				$matched,
				static fn ( array $run ): bool => null !== $run['drain_rate_session_pct_per_hour']
			)
		);
		$unmeasured = array_values(
			array_filter(
				$matched,
				static fn ( array $run ): bool => null === $run['drain_rate_session_pct_per_hour']
			)
		);

		$average_runtime = $this->average( $matched, 'projected_full_runtime_seconds', 0 );

		return array(
			'now'                                     => wp_date( 'c' ),
			'timezone'                                => wp_timezone_string(),
			'filters_applied'                         => $applied,
			'runs_matched'                            => count( $matched ),
			'runs_measured'                           => count( $measured ),
			'unmeasured_run_ids'                      => array_map( static fn ( array $run ): int => $run['id'], $unmeasured ),
			'average_drain_rate_session_pct_per_hour' => $this->average( $matched, 'drain_rate_session_pct_per_hour', 1 ),
			'average_drain_rate_10min_pct_per_hour'   => $this->average( $matched, 'drain_rate_10min_pct_per_hour', 1 ),
			'average_projected_full_runtime_seconds'  => null === $average_runtime ? null : (int) $average_runtime,
			'average_battery_drop_points'             => $this->average( $matched, 'battery_drop_points', 2 ),
			'total_elapsed_seconds'                   => (int) array_sum( array_column( $matched, 'elapsed_seconds' ) ),
			'fastest_drain'                           => $this->extreme( $measured, true ),
			'slowest_drain'                           => $this->extreme( $measured, false ),
		);
	}

	/**
	 * Averages one figure over the runs that have it.
	 *
	 * @param array<int, array<string, mixed>> $runs      The normalized runs.
	 * @param string                           $key       The run key holding the figure.
	 * @param int                              $precision Decimal places to round to.
	 * @return float|null The average, or null when no run has the figure.
	 */
	private function average( array $runs, string $key, int $precision ): ?float {
		$values = array_filter(
			array_column( $runs, $key ),
			static fn ( $value ): bool => null !== $value
		);

		if ( array() === $values ) {
			return null;
		}

		return round( array_sum( $values ) / count( $values ), $precision );
	}

	/**
	 * Finds the measured run with the fastest or the slowest whole-run drain
	 * rate; a tie goes to the lower id.
	 *
	 * @param array<int, array<string, mixed>> $measured The runs that have a whole-run drain rate.
	 * @param bool                             $fastest  True for the highest rate, false for the lowest.
	 * @return array{id: int, drain_rate_session_pct_per_hour: float}|null The run's id and rate, or null when no run was measured.
	 */
	private function extreme( array $measured, bool $fastest ): ?array {
		$pick = null;

		foreach ( $measured as $run ) {
			$rate = $run['drain_rate_session_pct_per_hour'];

			if ( null === $pick ) {
				$pick = $run;
				continue;
			}

			$beats = $fastest ? $rate > $pick['drain_rate_session_pct_per_hour'] : $rate < $pick['drain_rate_session_pct_per_hour'];
			$ties  = $rate === $pick['drain_rate_session_pct_per_hour'] && $run['id'] < $pick['id'];

			if ( $beats || $ties ) {
				$pick = $run;
			}
		}

		if ( null === $pick ) {
			return null;
		}

		return array(
			'id'                              => $pick['id'],
			'drain_rate_session_pct_per_hour' => $pick['drain_rate_session_pct_per_hour'],
		);
	}
}
