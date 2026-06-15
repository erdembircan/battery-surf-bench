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
	 * The single bootstrap instance.
	 */
	private static ?BatterySurfBench $instance = null;

	/**
	 * The plugin's service and configuration container.
	 */
	private Container $container;

	/**
	 * Builds the bootstrap and seeds the container with the plugin file path.
	 *
	 * @param $plugin_file Absolute path to the main plugin file.
	 */
	private function __construct( string $plugin_file ) {
		$this->container = new Container();
		$this->container->set( self::PLUGIN_FILE, $plugin_file );
	}

	/**
	 * Initializes the plugin, returning the shared bootstrap instance.
	 *
	 * @param $plugin_file Absolute path to the main plugin file.
	 * @return The shared bootstrap instance.
	 */
	public static function initialize( string $plugin_file ): BatterySurfBench {
		if ( null === self::$instance ) {
			self::$instance = new self( $plugin_file );
		}

		return self::$instance;
	}

	/**
	 * Returns the plugin's service and configuration container.
	 *
	 * @return The container instance.
	 */
	public function container(): Container {
		return $this->container;
	}
}
