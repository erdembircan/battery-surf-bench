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

use ErdemBircan\BatterySurfBench\Admin\Menu;
use ErdemBircan\BatterySurfBench\Container\Container;
use ErdemBircan\BatterySurfBench\Support\Component;

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
	 * Boots the plugin: builds the container and registers its components.
	 */
	public function init(): void {
		$this->container = new Container();
		$this->container->set( self::PLUGIN_FILE, $this->plugin_file );

		foreach ( $this->components() as $component ) {
			$component->register();
		}
	}

	/**
	 * Builds the components that make up the plugin. The bootstrap only
	 * composes and registers them; each component owns its own behaviour.
	 *
	 * @return Component[] The plugin's components.
	 */
	private function components(): array {
		return array(
			new Menu( $this->menu_icon_url() ),
		);
	}

	/**
	 * Resolves the public URL of the admin menu icon shipped with the plugin.
	 *
	 * @return string The menu icon URL.
	 */
	private function menu_icon_url(): string {
		return plugins_url( 'assets/images/menu-icon.png', $this->plugin_file );
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
