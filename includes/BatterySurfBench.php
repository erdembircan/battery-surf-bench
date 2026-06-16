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
use ErdemBircan\BatterySurfBench\Support\Manager;

use function plugins_url;

defined( 'ABSPATH' ) || exit;

/**
 * Bootstraps the Battery Surf Bench plugin.
 */
class BatterySurfBench {

	/**
	 * Registry identifier for the main plugin file path.
	 */
	public const PLUGIN_FILE = 'plugin_file';

	/**
	 * Absolute path to the main plugin file.
	 *
	 * @var string
	 */
	private string $plugin_file;

	/**
	 * The plugin's read-only configuration registry. Owned solely by the
	 * bootstrap; components receive only the values they need, never the
	 * registry itself.
	 *
	 * @var Registry
	 */
	private Registry $registry;

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
	 * Boots the plugin: builds the registry from configuration and registers
	 * its managers.
	 */
	public function init(): void {
		$config = require __DIR__ . '/Config.php';

		$this->registry = new Registry(
			array_merge( $config, array( self::PLUGIN_FILE => $this->plugin_file ) )
		);

		foreach ( $this->managers() as $manager ) {
			$manager->register();
		}
	}

	/**
	 * Builds the managers that make up the plugin. The bootstrap reads each
	 * manager's dependencies from the registry and injects only those, so a
	 * manager never reaches the registry itself.
	 *
	 * @return Manager[] The plugin's managers.
	 */
	private function managers(): array {
		return array(
			new Menu(
				$this->registry->get( 'admin_menu.slug' ),
				$this->registry->get( 'capability' ),
				$this->menu_icon_url(),
				$this->registry->get( 'version' )
			),
		);
	}

	/**
	 * Resolves the public URL of the admin menu icon shipped with the plugin.
	 *
	 * @return string The menu icon URL.
	 */
	private function menu_icon_url(): string {
		return plugins_url(
			$this->registry->get( 'admin_menu.icon' ),
			$this->registry->get( self::PLUGIN_FILE )
		);
	}
}
