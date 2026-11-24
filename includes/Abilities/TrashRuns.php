<?php
/**
 * The trash-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function array_map;
use function count;
use function defined;
use function implode;
use function sprintf;
use function wp_trash_post;

defined( 'ABSPATH' ) || exit;

/**
 * Moves benchmark runs to the trash.
 */
class TrashRuns implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/trash-runs';

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
			'label'         => __( 'Move benchmark runs to the trash', 'battery-surf-bench' ),
			'description'   => __( "Moves the benchmark runs with the given ids to the trash, which removes them from the Sessions screen and from every other ability until they're restored with battery-surf-bench/restore-runs. WordPress empties the trash after a while, 30 days by default, so restore them before then. Find the runs with battery-surf-bench/list-runs, show them to the user and get their confirmation before calling this. If any id isn't a recorded run, or the site keeps no trash, nothing is moved.", 'battery-surf-bench' ),
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
						'minItems'    => 1,
						'maxItems'    => 100,
						'uniqueItems' => true,
						'description' => __( 'The ids of the runs to move to the trash.', 'battery-surf-bench' ),
					),
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'trashed_count' => array( 'type' => 'integer' ),
					'trashed'       => array(
						'type'  => 'array',
						'items' => RunSchema::detail(),
					),
				),
			),
			'annotations'   => Annotations::trash(),
		);
	}

	/**
	 * Moves the runs to the trash, once every id is known to be a recorded run.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The runs as they were before trashing, or an error that leaves them where they were when an id isn't recorded.
	 */
	public function execute( array $input ): array|WP_Error {
		if ( ! $this->keeps_trash() ) {
			return new WP_Error(
				'bsbench_trash_disabled',
				__( 'This site keeps no trash, so moving these runs to the trash would delete them for good. Nothing was moved.', 'battery-surf-bench' ),
				array( 'status' => 409 )
			);
		}

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
				'bsbench_trash_not_found',
				sprintf(
					/* translators: %s: A comma-separated list of ids. */
					__( "These ids aren't recorded benchmark runs: %s. Nothing was moved to the trash.", 'battery-surf-bench' ),
					implode( ', ', $missing )
				),
				array( 'status' => 404 )
			);
		}

		foreach ( $runs as $run ) {
			if ( ! wp_trash_post( $run['id'] ) ) {
				return new WP_Error(
					'bsbench_trash_failed',
					sprintf(
						/* translators: %d: A benchmark run id. */
						__( "The run with the id %d couldn't be moved to the trash. The runs before it in the list were moved.", 'battery-surf-bench' ),
						$run['id']
					),
					array( 'status' => 500 )
				);
			}
		}

		return array(
			'trashed_count' => count( $runs ),
			'trashed'       => $runs,
		);
	}

	/**
	 * Whether this site keeps a trash. With `EMPTY_TRASH_DAYS` at zero,
	 * `wp_trash_post()` deletes a post for good instead of trashing it.
	 *
	 * @return bool Whether trashing a run can be undone.
	 */
	protected function keeps_trash(): bool {
		return ! defined( 'EMPTY_TRASH_DAYS' ) || (bool) EMPTY_TRASH_DAYS;
	}
}
