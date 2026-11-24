<?php
/**
 * The add-course-page ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function array_merge;
use function array_splice;
use function count;

defined( 'ABSPATH' ) || exit;

/**
 * Adds a page to the course: one of the site's posts or pages, or a bundled page.
 */
class AddCoursePage implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/add-course-page';

	/**
	 * Stores the collaborator that edits the course.
	 *
	 * @param CourseEditor $editor Reads, checks and saves the course.
	 */
	public function __construct( private CourseEditor $editor ) {
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
			'label'         => __( 'Add a page to the course', 'battery-surf-bench' ),
			'description'   => __( 'Adds a page to the course, at the end or at the position you give. Name one of the site\'s posts or pages by its post id (find it with battery-surf-bench/find-pages), or a bundled page by its slug (see battery-surf-bench/get-course). Only published, public posts and pages can be added: drafts, pending, scheduled and private ones are refused.', 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'properties'           => array_merge(
					$this->editor->page_properties(),
					array(
						'position' => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'Where to put the page, counting from 1. Leave it out to add the page at the end.', 'battery-surf-bench' ),
						),
					)
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array_merge(
					RunSchema::course(),
					array( 'added' => RunSchema::course_page() )
				),
			),
			'annotations'   => Annotations::write(),
		);
	}

	/**
	 * Adds the page to the course.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The course with the page added, or an error saying why the page can't be added.
	 */
	public function execute( array $input ): array|WP_Error {
		$entry = $this->editor->entry_from_input( $input );

		if ( $entry instanceof WP_Error ) {
			return $entry;
		}

		if ( 'user' === $entry['kind'] ) {
			$eligibility = $this->editor->eligibility( $entry['id'] );

			if ( $eligibility instanceof WP_Error ) {
				return $eligibility;
			}
		}

		$entries  = $this->editor->entries();
		$existing = $this->editor->position_of_entry( $entries, $entry );

		if ( null !== $existing ) {
			return $this->editor->already_in_course( $entry, $existing );
		}

		$highest  = count( $entries ) + 1;
		$position = isset( $input['position'] ) ? (int) $input['position'] : $highest;

		if ( $position > $highest ) {
			return $this->editor->out_of_range( $position, $highest );
		}

		array_splice( $entries, $position - 1, 0, array( $entry ) );

		$saved = $this->editor->save( $entries );

		if ( $this->editor->position_of_entry( $saved, $entry ) !== $position ) {
			return new WP_Error(
				'bsbench_course_not_saved',
				__( 'The course couldn\'t be saved.', 'battery-surf-bench' ),
				array( 'status' => 500 )
			);
		}

		return array_merge(
			$this->editor->course( $saved ),
			array( 'added' => $this->editor->describe_entry( $entry, $position ) )
		);
	}
}
