<?php
/**
 * The get-run ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * Returns one benchmark run in full: the one asked for, or the newest.
 */
class GetRun implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/get-run';

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
			'label'         => __( 'Get a benchmark run', 'battery-surf-bench' ),
			'description'   => __( 'Returns one battery benchmark run in full: how it ended and why, its length, battery levels and drop, both drain rates, the projected full-battery runtime, the setup it ran with, the browser and operating system it ran on, and a link to its report in wp-admin. Leave out the id to get the newest run.', 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'properties'           => array(
					'id' => array(
						'type'        => 'integer',
						'minimum'     => 1,
						'description' => __( "The run's id. Leave it out to get the newest run.", 'battery-surf-bench' ),
					),
				),
			),
			'output_schema' => RunSchema::detail(),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Reads the run asked for, or the newest one when no id is given.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The run, or an error when it isn't recorded.
	 */
	public function execute( array $input ): array|WP_Error {
		if ( ! isset( $input['id'] ) ) {
			$newest = $this->reader->newest();

			if ( null === $newest ) {
				return new WP_Error(
					'bsbench_no_runs',
					__( 'No benchmark runs have been recorded yet.', 'battery-surf-bench' ),
					array( 'status' => 404 )
				);
			}

			return $newest;
		}

		$id  = (int) $input['id'];
		$run = $this->reader->find( $id );

		if ( null === $run ) {
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

		return $run;
	}
}
