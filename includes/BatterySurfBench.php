<?php
/**
 * Plugin bootstrap.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Container\Container;

defined( 'ABSPATH' ) || exit;

/**
 * Bootstraps the Battery Surf Bench plugin.
 */
class BatterySurfBench {

	/**
	 * Container identifier for the main plugin file path.
	 */
	public const PLUGIN_FILE = 'plugin.file';

	/**
	 * The plugin's service and configuration container.
	 *
	 * @var Container
	 */
	private Container $container;

	/**
	 * Builds the bootstrap and seeds the container with the plugin file path.
	 *
	 * @param string $plugin_file Absolute path to the main plugin file.
	 */
	public function __construct( string $plugin_file ) {
		$this->container = new Container();
		$this->container->set( self::PLUGIN_FILE, $plugin_file );
	}

	/**
	 * Returns the plugin's service and configuration container.
	 *
	 * @return Container The container instance.
	 */
	public function container(): Container {
		return $this->container;
	}
}
