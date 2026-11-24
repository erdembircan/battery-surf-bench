<?php
/**
 * The get-course ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use function __;

defined( 'ABSPATH' ) || exit;

/**
 * Returns the surf course: the pages the simulated surfer visits, in order.
 */
class GetCourse extends CourseAbility {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/get-course';

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
			'label'         => __( 'Get the surf course', 'battery-surf-bench' ),
			'description'   => __( "Returns the course: the pages the simulated surfer visits during a benchmark, in visit order. Each page is either bundled with the plugin, identified by its slug, or one of the site's own posts and pages, identified by its post id. Also lists every bundled page and whether it's in the course.", 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => RunSchema::course(),
			),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Describes the saved course.
	 *
	 * @param array<string, mixed> $input The validated input, which is empty.
	 * @return array<string, mixed> The course.
	 */
	public function execute( array $input ): array {
		return $this->course( $this->editor->entries() );
	}
}
