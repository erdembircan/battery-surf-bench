<?php
/**
 * The list-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function array_map;
use function array_merge;
use function array_slice;
use function count;
use function wp_date;
use function wp_timezone_string;

defined( 'ABSPATH' ) || exit;

/**
 * Lists the recorded benchmark runs, filtered and sorted.
 */
class ListRuns implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/list-runs';

	/**
	 * Stores the collaborators that read and narrow the runs.
	 *
	 * @param SessionReader $reader Reads the recorded runs.
	 * @param RunFilter     $filter Filters and sorts them.
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
		return array(
			'label'         => __( 'List benchmark runs', 'battery-surf-bench' ),
			'description'   => __( "Lists the battery benchmark runs recorded on this site, newest first unless you choose another order. Filter by status, run mode, browser, operating system or start date, and sort by drain rate, battery drop, length or projected runtime, for example to find the run that drained the battery fastest. Each run comes with its status, how it ended, its length, battery levels, drain rates and a link to its report. A drain rate or projection the run couldn't measure is null, and nulls always sort last. Dates are in the site's timezone, which the result reports along with the current time.", 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'properties'           => array_merge(
					RunSchema::filters(),
					array(
						'order_by' => array(
							'type'        => 'string',
							'enum'        => array( 'started_at', 'drain_rate_session', 'drain_rate_10min', 'battery_drop', 'elapsed', 'projected_runtime' ),
							'default'     => 'started_at',
							'description' => __( 'What to sort the runs by. started_at: when they started. drain_rate_session: the whole-run drain rate. drain_rate_10min: the drain rate over the run\'s last 10 minutes. battery_drop: how many percentage points the battery fell. elapsed: how long they ran. projected_runtime: the projected full-battery runtime.', 'battery-surf-bench' ),
						),
						'order'    => array(
							'type'        => 'string',
							'enum'        => array( 'asc', 'desc' ),
							'default'     => 'desc',
							'description' => __( 'desc for highest or newest first, asc for lowest or oldest first. Runs with no value for the sort field always come last.', 'battery-surf-bench' ),
						),
						'limit'    => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'maximum'     => 100,
							'default'     => 20,
							'description' => __( 'How many runs to return, from 1 to 100.', 'battery-surf-bench' ),
						),
						'offset'   => array(
							'type'        => 'integer',
							'minimum'     => 0,
							'default'     => 0,
							'description' => __( 'How many matching runs to skip, for paging through long lists.', 'battery-surf-bench' ),
						),
					)
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'now'      => array( 'type' => 'string' ),
					'timezone' => array( 'type' => 'string' ),
					'total'    => array( 'type' => 'integer' ),
					'returned' => array( 'type' => 'integer' ),
					'runs'     => array(
						'type'  => 'array',
						'items' => RunSchema::summary(),
					),
				),
			),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Lists the runs that match the filters, sorted, one page at a time.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The runs, or an error when a date filter can't be read.
	 */
	public function execute( array $input ): array|WP_Error {
		$matching = $this->filter->filter( $this->reader->all(), $input );

		if ( $matching instanceof WP_Error ) {
			return $matching;
		}

		$sorted = $this->filter->sort(
			$matching,
			(string) ( $input['order_by'] ?? 'started_at' ),
			(string) ( $input['order'] ?? 'desc' )
		);
		$page   = array_slice( $sorted, (int) ( $input['offset'] ?? 0 ), (int) ( $input['limit'] ?? 20 ) );

		return array(
			'now'      => wp_date( 'c' ),
			'timezone' => wp_timezone_string(),
			'total'    => count( $sorted ),
			'returned' => count( $page ),
			'runs'     => array_map( array( $this, 'summarize' ), $page ),
		);
	}

	/**
	 * Cuts a run down to its summary: the run without its setup and reading count.
	 *
	 * @param array<string, mixed> $run The normalized run.
	 * @return array<string, mixed> The run summary.
	 */
	private function summarize( array $run ): array {
		unset( $run['setup'], $run['reading_count'] );

		return $run;
	}
}
