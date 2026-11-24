<?php
/**
 * The restore-runs ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function add_filter;
use function array_map;
use function count;
use function implode;
use function remove_filter;
use function sprintf;
use function wp_untrash_post;

defined( 'ABSPATH' ) || exit;

/**
 * Brings benchmark runs back from the trash.
 */
class RestoreRuns implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/restore-runs';

	/**
	 * Stores the collaborator that reads the recorded runs.
	 *
	 * @param SessionReader $reader Reads the recorded and the trashed runs.
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
			'label'         => __( 'Restore benchmark runs from the trash', 'battery-surf-bench' ),
			'description'   => __( "Brings benchmark runs back from the trash, so they show again on the Sessions screen and in every other ability. Find the runs in the trash with battery-surf-bench/list-runs and in_trash set to true. If any id isn't a run in the trash, nothing is restored.", 'battery-surf-bench' ),
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
						'description' => __( 'The ids of the trashed runs to restore.', 'battery-surf-bench' ),
					),
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'restored_count' => array( 'type' => 'integer' ),
					'restored'       => array(
						'type'  => 'array',
						'items' => RunSchema::detail(),
					),
				),
			),
			'annotations'   => Annotations::write(),
		);
	}

	/**
	 * Restores the runs, once every id is known to be a run in the trash.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The runs as they are after restoring, or an error that leaves them where they were when an id isn't in the trash.
	 */
	public function execute( array $input ): array|WP_Error {
		$ids     = array_map( 'intval', (array) ( $input['ids'] ?? array() ) );
		$missing = array();

		foreach ( $ids as $id ) {
			if ( null === $this->reader->find_trashed( $id ) ) {
				$missing[] = $id;
			}
		}

		if ( array() !== $missing ) {
			return new WP_Error(
				'bsbench_restore_not_found',
				sprintf(
					/* translators: %s: A comma-separated list of ids. */
					__( "These ids aren't runs in the trash: %s. Nothing was restored.", 'battery-surf-bench' ),
					implode( ', ', $missing )
				),
				array( 'status' => 404 )
			);
		}

		// Core restores a trashed post as a draft; a run goes back to the status
		// it had when it was trashed, which is published.
		add_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status', 10, 3 );

		try {
			foreach ( $ids as $id ) {
				if ( ! wp_untrash_post( $id ) ) {
					return new WP_Error(
						'bsbench_restore_failed',
						sprintf(
							/* translators: %d: A benchmark run id. */
							__( "The run with the id %d couldn't be restored. The runs before it in the list were restored.", 'battery-surf-bench' ),
							$id
						),
						array( 'status' => 500 )
					);
				}
			}
		} finally {
			remove_filter( 'wp_untrash_post_status', 'wp_untrash_post_set_previous_status', 10 );
		}

		$restored = array();

		foreach ( $ids as $id ) {
			$restored[] = $this->reader->find( $id );
		}

		return array(
			'restored_count' => count( $restored ),
			'restored'       => $restored,
		);
	}
}
