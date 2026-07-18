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
use ErdemBircan\BatterySurfBench\Container\Definitions;
use ErdemBircan\BatterySurfBench\Container\DefinitionsSource;
use ErdemBircan\BatterySurfBench\Container\InstanceStore;
use ErdemBircan\BatterySurfBench\Container\Instantiator;
use ErdemBircan\BatterySurfBench\Container\Registry;
use ErdemBircan\BatterySurfBench\Content\SessionDetail;
use ErdemBircan\BatterySurfBench\Content\SessionRestQuery;
use ErdemBircan\BatterySurfBench\Content\SessionType;
use ErdemBircan\BatterySurfBench\Core\I18n;
use ErdemBircan\BatterySurfBench\Course\CourseRouter;
use ErdemBircan\BatterySurfBench\DevTools\DevTools;
use ErdemBircan\BatterySurfBench\Settings\OptionRegistry;

use function is_readable;
use function wp_get_environment_type;

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
	 *
	 * The service recipes load from the build-time compiled artifact —
	 * {@see \ErdemBircan\BatterySurfBench\Container\ContainerCompiler}, run by
	 * `bin/BuildContainer.php`, pre-resolves every `%token%` recipe value
	 * against the registry so the runtime never has to — only outside a
	 * development environment, gated via {@see DefinitionsSource} against
	 * `wp_get_environment_type()` the same way
	 * {@see \ErdemBircan\BatterySurfBench\DevTools\DevTools} gates itself; a
	 * stale compiled artifact left on disk in `local`/`development` would
	 * otherwise silently shadow live edits to `Services.php`. Anywhere else
	 * the compiled artifact is used when readable, the same
	 * `is_readable()`-guarded pattern
	 * {@see \ErdemBircan\BatterySurfBench\Core\Assets::manifest()} uses for
	 * its own generated build artifact — falling back to the live,
	 * token-bearing `Services.php` otherwise.
	 */
	public function init(): void {
		$registry = new Registry( require __DIR__ . '/Core/Config.php' );
		$compiled = __DIR__ . '/../build/Services.compiled.php';
		$live     = __DIR__ . '/Container/Services.php';

		$use_compiled = ( new DefinitionsSource() )->prefers_compiled(
			wp_get_environment_type(),
			$registry->get( 'container.dev_environments' ),
			is_readable( $compiled )
		);

		$definitions  = new Definitions( require $use_compiled ? $compiled : $live );
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
