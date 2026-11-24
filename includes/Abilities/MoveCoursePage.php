<?php
/**
 * The move-course-page ability.
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
 * Moves a page that is already in the course to a new position.
 */
class MoveCoursePage implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/move-course-page';

	/**
	 * Stores the collaborator that edits the course.
	 *
	 * @param CourseEditor $editor Reads and saves the course.
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
			'label'         => __( 'Move a course page', 'battery-surf-bench' ),
			'description'   => __( 'Moves a page that\'s already in the course to a new position. Position 1 is the first page the surfer visits.', 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'required'             => array( 'position' ),
				'properties'           => array_merge(
					$this->editor->page_properties(),
					array(
						'position' => array(
							'type'        => 'integer',
							'minimum'     => 1,
							'description' => __( 'The page\'s new position, counting from 1.', 'battery-surf-bench' ),
						),
					)
				),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array_merge(
					RunSchema::course(),
					array( 'moved' => RunSchema::course_page() )
				),
			),
			'annotations'   => Annotations::write(),
		);
	}

	/**
	 * Moves the page to its new position.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The course with the page moved, or an error saying why it can't be.
	 */
	public function execute( array $input ): array|WP_Error {
		$entry = $this->editor->entry_from_input( $input );

		if ( $entry instanceof WP_Error ) {
			return $entry;
		}

		$entries = $this->editor->entries();
		$current = $this->editor->position_of_entry( $entries, $entry );

		if ( null === $current ) {
			return $this->editor->not_in_course( $entry );
		}

		$position = (int) ( $input['position'] ?? 0 );

		if ( $position < 1 || $position > count( $entries ) ) {
			return $this->editor->out_of_range( $position, count( $entries ) );
		}

		array_splice( $entries, $current - 1, 1 );
		array_splice( $entries, $position - 1, 0, array( $entry ) );

		$saved = $this->editor->save( $entries );

		return array_merge(
			$this->editor->course( $saved ),
			array( 'moved' => $this->editor->describe_entry( $entry, $position ) )
		);
	}
}
