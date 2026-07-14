<?php
/**
 * Surf-course order option definition.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use ErdemBircan\BatterySurfBench\Settings\OptionProvider;

use function __;

defined( 'ABSPATH' ) || exit;

/**
 * Describes the surf-course order option: a `register_setting()` definition
 * with a REST schema wide enough to express its ordered, heterogeneous
 * entries, so the settings app can read and write it through the core-data
 * site-settings entity instead of a bespoke REST controller.
 *
 * This is a plain {@see OptionProvider}, not a
 * {@see \ErdemBircan\BatterySurfBench\Support\Manager}: the surf-course
 * order's shape and sanitization are a course-domain concern, so they are
 * described here, but registering the definition with WordPress is
 * {@see \ErdemBircan\BatterySurfBench\Settings\OptionRegistry}'s job — the
 * plugin's one general options manager. `definition()` is built fresh on
 * every call (never cached from the constructor), so the `__()` it calls for
 * the option's `description` only ever runs when the registry actually asks
 * for it, from inside its own `init` callback — never at composition time.
 */
class CourseOrderOption implements OptionProvider {

	/**
	 * Stores the option name and the sanitizer that validates it.
	 *
	 * @param string               $option_name Name of the option the surf-course order is saved under.
	 * @param CourseOrderSanitizer $sanitizer   Validates the saved order.
	 */
	public function __construct(
		private string $option_name,
		private CourseOrderSanitizer $sanitizer
	) {
	}

	/**
	 * Builds this option's `register_setting()` definition: a schema wide
	 * enough to express the ordered, heterogeneous entries, plus the
	 * sanitizer's default (the bundled catalog, for a fresh install) and
	 * sanitize callback — so a malformed saved order is cleaned on every save.
	 *
	 * @return array{name: string, args: array<string, mixed>} The option name and its `register_setting()` args.
	 */
	public function definition(): array {
		return array(
			'name' => $this->option_name,
			'args' => array(
				'type'              => 'array',
				'description'       => __( "The surfer's test page sequence: bundled pages and the site owner's own posts and pages, in visit order.", 'battery-surf-bench' ),
				'default'           => $this->sanitizer->default_order(),
				'show_in_rest'      => array(
					'schema' => array(
						'type'  => 'array',
						'items' => array(
							'type'       => 'object',
							'properties' => array(
								'kind' => array(
									'type' => 'string',
									'enum' => array( 'bundled', 'user' ),
								),
								'slug' => array( 'type' => 'string' ),
								'id'   => array( 'type' => 'integer' ),
							),
						),
					),
				),
				'sanitize_callback' => array( $this->sanitizer, 'sanitize' ),
			),
		);
	}
}
