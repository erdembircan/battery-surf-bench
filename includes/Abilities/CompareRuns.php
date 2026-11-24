<?php
/**
 * The compare-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function array_map;
use function implode;
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * Returns several benchmark runs side by side, in the order they were asked for.
 */
class CompareRuns implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/compare-runs';

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
			'label'         => __( 'Compare benchmark runs', 'battery-surf-bench' ),
			'description'   => __( 'Returns two or more benchmark runs side by side, in the order you list them, each with its battery drop, both drain rates, projected full-battery runtime, length, setup, browser and how it ended.', 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'required'             => array( 'ids' ),
				'properties'           => array(
					'ids' => array(
						'type'        => 'array',
						'items'       => array(
							'type'    => 'integer',
							'minimum' => 1,
						),
						'minItems'    => 2,
						'maxItems'    => 10,
						'uniqueItems' => true,
						'description' => __( 'The ids of the runs to compare, from 2 to 10.', 'battery-surf-bench' ),
					),
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'runs' => array(
						'type'  => 'array',
						'items' => RunSchema::detail(),
					),
				),
			),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Reads the runs asked for, in the order asked for.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The runs, or an error naming every id that isn't recorded.
	 */
	public function execute( array $input ): array|WP_Error {
		$runs    = array();
		$missing = array();

		foreach ( array_map( 'intval', (array) ( $input['ids'] ?? array() ) ) as $id ) {
			$run = $this->reader->find( $id );

			if ( null === $run ) {
				$missing[] = $id;
				continue;
			}

			$runs[] = $run;
		}

		if ( array() !== $missing ) {
			return new WP_Error(
				'bsbench_compare_not_found',
				sprintf(
					/* translators: %s: A comma-separated list of ids. */
					__( "These ids aren't recorded benchmark runs: %s.", 'battery-surf-bench' ),
					implode( ', ', $missing )
				),
				array( 'status' => 404 )
			);
		}

		return array( 'runs' => $runs );
	}
}
