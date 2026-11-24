<?php
/**
 * The reset-course ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use function __;

defined( 'ABSPATH' ) || exit;

/**
 * Replaces the course with the default: the bundled pages in their original order.
 */
class ResetCourse implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/reset-course';

	/**
	 * Stores the collaborator that saves the course.
	 *
	 * @param CourseEditor $editor Saves and describes the course.
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
			'label'         => __( 'Reset the course', 'battery-surf-bench' ),
			'description'   => __( "Replaces the course with the default: the five bundled pages in their original order. The site's own posts and pages leave the course, but stay on the site.", 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
				'properties'           => array(),
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => RunSchema::course(),
			),
			'annotations'   => Annotations::reset(),
		);
	}

	/**
	 * Saves the default course.
	 *
	 * @param array<string, mixed> $input The validated input, which is empty.
	 * @return array<string, mixed> The course as saved.
	 */
	public function execute( array $input ): array {
		return $this->editor->course( $this->editor->reset() );
	}
}
