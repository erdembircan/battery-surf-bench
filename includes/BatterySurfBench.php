<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

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
	 * Absolute path to the main plugin file.
	 *
	 * @var string
	 */
	private string $plugin_file;

	/**
	 * The plugin's service and configuration container.
	 *
	 * @var Container
	 */
	private Container $container;

	/**
	 * Stores the plugin file path. No work is done here so the object can be
	 * constructed without side effects.
	 *
	 * @param string $plugin_file Absolute path to the main plugin file.
	 */
	public function __construct( string $plugin_file ) {
		$this->plugin_file = $plugin_file;
	}

	/**
	 * Boots the plugin: builds the container and wires up its services.
	 */
	public function init(): void {
		$this->container = new Container();
		$this->container->set( self::PLUGIN_FILE, $this->plugin_file );
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
