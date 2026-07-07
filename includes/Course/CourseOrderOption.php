<?php
/**
 * Surf-course order option registration.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function register_setting;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the surf-course order option with a REST schema wide enough to
 * express its ordered, heterogeneous entries, so the settings app can read
 * and write it through the core-data site-settings entity instead of a
 * bespoke REST controller.
 *
 * This used to live on {@see \ErdemBircan\BatterySurfBench\Admin\SettingsScreen},
 * but the option itself belongs to the course domain, not to the admin screen
 * that happens to be the one UI reading and writing it.
 */
class CourseOrderOption implements Manager {

	/**
	 * Stores the option name and the sanitizer that validates and heals it.
	 *
	 * @param string               $option_name Name of the option the surf-course order is saved under.
	 * @param CourseOrderSanitizer $sanitizer   Validates and heals the saved order.
	 */
	public function __construct(
		private string $option_name,
		private CourseOrderSanitizer $sanitizer
	) {
	}

	/**
	 * Hooks the option's registration into the WordPress lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_setting_callback' ) );
	}

	/**
	 * Registers the option with WordPress: a healing schema wide enough to
	 * express the ordered, heterogeneous entries, plus the sanitizer's default
	 * and sanitize callback — so a stale or malformed saved order self-heals.
	 *
	 * @return void
	 */
	public function register_setting_callback(): void {
		register_setting(
			'bsb_settings',
			$this->option_name,
			array(
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
			)
		);
	}
}
