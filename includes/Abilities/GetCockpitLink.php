<?php
/**
 * The get-cockpit-link ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use function __;
use function add_query_arg;
use function admin_url;
use function home_url;

defined( 'ABSPATH' ) || exit;

/**
 * Returns the link to the cockpit, where a benchmark is started.
 *
 * A benchmark can't be started from here: it runs in a browser on the device
 * being tested, because only a Chromium browser can read the battery level.
 */
class GetCockpitLink implements Ability {

	/**
	 * The ability's registered name.
	 *
	 * @var string
	 */
	private const NAME = 'battery-surf-bench/get-cockpit-link';

	/**
	 * Stores where the cockpit and the Sessions screen live.
	 *
	 * @param string $cockpit_param URL parameter that serves the cockpit.
	 * @param string $cockpit_value Value of that parameter.
	 * @param string $screen_slug   Slug of the Sessions screen.
	 */
	public function __construct(
		private string $cockpit_param,
		private string $cockpit_value,
		private string $screen_slug
	) {
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
			'label'         => __( 'Get the benchmark cockpit link', 'battery-surf-bench' ),
			'description'   => __( "Returns the link to the cockpit, the dashboard where battery benchmarks run. A benchmark can't be started from here: it runs in the browser, so the user opens the link in a Chromium-based browser on the device being tested, unplugs the charger and presses start. Also returns the link to the Sessions screen, which lists every recorded run.", 'battery-surf-bench' ),
			'input_schema'  => array(
				'type'                 => 'object',
				'default'              => array(),
				'additionalProperties' => false,
			),
			'output_schema' => array(
				'type'       => 'object',
				'properties' => array(
					'cockpit_url'  => array( 'type' => 'string' ),
					'sessions_url' => array( 'type' => 'string' ),
					'requirements' => array(
						'type'  => 'array',
						'items' => array( 'type' => 'string' ),
					),
				),
			),
			'annotations'   => Annotations::read(),
		);
	}

	/**
	 * Builds the cockpit and Sessions links and what a benchmark needs.
	 *
	 * @param array<string, mixed> $input The validated input, which is empty.
	 * @return array<string, mixed> The links and requirements.
	 */
	public function execute( array $input ): array {
		return array(
			'cockpit_url'  => add_query_arg( $this->cockpit_param, $this->cockpit_value, home_url( '/' ) ),
			'sessions_url' => admin_url( 'admin.php?page=' . $this->screen_slug ),
			'requirements' => array(
				__( 'Open the link in a Chromium-based browser, such as Chrome, Edge or Opera: only these can read the battery level.', 'battery-surf-bench' ),
				__( 'Use the device whose battery you want to test, signed in to this site as an administrator.', 'battery-surf-bench' ),
				__( "Unplug the charger first. A benchmark won't start while the device is charging, and plugging in during a run ends it.", 'battery-surf-bench' ),
				__( 'Keep the cockpit tab open until the run ends. The run is saved as soon as it ends.', 'battery-surf-bench' ),
			),
		);
	}
}
