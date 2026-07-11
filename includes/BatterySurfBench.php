<?php
/**
 * Plugin bootstrap.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Admin\SessionsScreen;
use ErdemBircan\BatterySurfBench\Admin\SettingsScreen;
use ErdemBircan\BatterySurfBench\Admin\StartBenchmark;
use ErdemBircan\BatterySurfBench\Cockpit\Cockpit;
use ErdemBircan\BatterySurfBench\Content\SessionDetail;
use ErdemBircan\BatterySurfBench\Content\SessionRestQuery;
use ErdemBircan\BatterySurfBench\Content\SessionType;
use ErdemBircan\BatterySurfBench\Course\CourseRouter;
use ErdemBircan\BatterySurfBench\DevTools\DevTools;
use ErdemBircan\BatterySurfBench\Settings\OptionRegistry;

defined( 'ABSPATH' ) || exit;

/**
 * Bootstraps the Battery Surf Bench plugin.
 */
class BatterySurfBench {

	/**
	 * Fully-qualified class names of the plugin's managers, in the order
	 * their `register()` must be called.
	 *
	 * @var string[]
	 */
	private const MANAGERS = array(
		I18n::class,
		OptionRegistry::class,
		SettingsScreen::class,
		SessionType::class,
		SessionRestQuery::class,
		SessionsScreen::class,
		StartBenchmark::class,
		CourseRouter::class,
		Cockpit::class,
		SessionDetail::class,
		DevTools::class,
	);

	/**
	 * Stores the plugin file path. No work is done here so the object can be
	 * constructed without side effects.
	 *
	 * @param string $plugin_file Absolute path to the main plugin file.
	 */
	public function __construct( private string $plugin_file ) {
	}

	/**
	 * Boots the plugin: builds the DI collaborators from the plugin's
	 * configuration and service recipes, then builds and registers every
	 * manager through the instantiator.
	 */
	public function init(): void {
		$registry     = new Registry( require __DIR__ . '/Config.php' );
		$definitions  = new Definitions( require __DIR__ . '/Services.php' );
		$instances    = new InstanceStore();
		$instantiator = new Instantiator(
			$registry,
			$definitions,
			$instances,
			array( 'plugin_file' => $this->plugin_file )
		);

		foreach ( self::MANAGERS as $manager ) {
			$instantiator->make( $manager )->register();
		}
	}
}
