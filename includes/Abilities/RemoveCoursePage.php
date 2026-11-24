<?php
/**
 * The remove-course-page ability.
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
 * Takes a page out of the course. The course always keeps at least one page.
 */
class RemoveCoursePage extends CourseAbility {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/remove-course-page';

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
			'label'         => __( 'Remove a page from the course', 'battery-surf-bench' ),
			'description'   => __( 'Takes a page out of the course. The page itself stays on the site, and it can be added back at any time. The course always keeps at least one page.', 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'properties'           => $this->page_properties(),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array_merge(
					RunSchema::course(),
					array( 'removed' => RunSchema::course_page() )
				),
			),
			'annotations'   => Annotations::write(),
		);
	}

	/**
	 * Takes the page out of the course.
	 *
	 * @param array<string, mixed> $input The validated input.
	 * @return array<string, mixed>|WP_Error The course without the page, or an error saying why it can't be removed.
	 */
	public function execute( array $input ): array|WP_Error {
		$entry = $this->entry_from_input( $input );

		if ( $entry instanceof WP_Error ) {
			return $entry;
		}

		$entries  = $this->editor->entries();
		$position = $this->position_of_entry( $entries, $entry );

		if ( null === $position ) {
			return $this->not_in_course( $entry );
		}

		if ( 1 === count( $entries ) ) {
			return new WP_Error(
				'bsbench_last_page',
				__( 'The course needs at least one page, so its only page can\'t be removed.', 'battery-surf-bench' ),
				array( 'status' => 409 )
			);
		}

		$removed = $this->editor->describe( $entries )[ $position - 1 ];

		array_splice( $entries, $position - 1, 1 );

		return array_merge(
			$this->course( $this->editor->save( $entries ) ),
			array( 'removed' => $removed )
		);
	}
}
