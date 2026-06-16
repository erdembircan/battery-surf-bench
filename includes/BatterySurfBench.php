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

defined( 'ABSPATH' ) || exit;

/**
 * Bootstraps the Battery Surf Bench plugin.
 */
class BatterySurfBench {

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
	 * Resolves filesystem paths and URLs for the assets shipped with the plugin.
	 *
	 * @var Paths
	 */
	private Paths $paths;

	/**
	 * Enqueues the plugin's script and style files.
	 *
	 * @var Assets
	 */
	private Assets $assets;

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
	 * Boots the plugin: builds the registry, path resolver and asset service,
	 * then registers its managers.
	 */
	public function init(): void {
		$this->registry = new Registry( require __DIR__ . '/Config.php' );
		$this->paths    = new Paths( $this->plugin_file );
		$this->assets   = new Assets( $this->registry->get( 'namespace' ), $this->paths );

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
				$this->paths->url( $this->registry->get( 'admin_menu.icon' ) ),
				$this->registry->get( 'admin_menu.style' ),
				$this->assets
			),
		);
	}
}
