<?php
/**
 * The get-run-readings ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function count;
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * Returns the battery readings a benchmark run recorded.
 */
class GetRunReadings implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/get-run-readings';

	/**
	 * Stores the collaborator that reads the recorded runs.
	 *
	 * @param SessionReader $reader Reads the recorded runs.
	 */
	public function __construct( private SessionReader $reader ) {
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
			'label'         => __( "Get a run's battery readings", 'battery-surf-bench' ),
			'description'   => __( 'Returns the battery readings a benchmark run recorded, in order, ready to chart. Each reading marks the moment the battery reached a new level: the seconds since the run started, the battery level in percent, and whether a charger was connected.', 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'required'             => array( 'id' ),
				'properties'           => array(
					'id' => array(
						'type'        => 'integer',
						'minimum'     => 1,
						'description' => __( "The run's id.", 'battery-surf-bench' ),
					),
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'id'            => array( 'type' => 'integer' ),
					'reading_count' => array( 'type' => 'integer' ),
					'readings'      => array(
						'type'  => 'array',
						'items' => RunSchema::reading(),
					),
				),
			),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Reads a run's readings.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The readings, or an error when the run isn't recorded.
	 */
	public function execute( array $input ): array|WP_Error {
		$id = (int) ( $input['id'] ?? 0 );

		if ( null === $this->reader->find( $id ) ) {
			return new WP_Error(
				'bsbench_run_not_found',
				sprintf(
					/* translators: %d: A benchmark run id. */
					__( "There's no benchmark run with the id %d.", 'battery-surf-bench' ),
					$id
				),
				array( 'status' => 404 )
			);
		}

		$readings = $this->reader->readings( $id );

		return array(
			'id'            => $id,
			'reading_count' => count( $readings ),
			'readings'      => $readings,
		);
	}
}
