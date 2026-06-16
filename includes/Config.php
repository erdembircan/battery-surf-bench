<?php
/**
 * Plugin configuration values.
 *
 * Returns an associative array loaded into the Registry at bootstrap. The
 * bootstrap reads values from the registry and injects only what each component
 * needs, so this file is the single source of the plugin's configuration.
 * Nested values are reached with dot notation (e.g. `admin_menu.slug`).
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

defined( 'ABSPATH' ) || exit;

return array(
	'namespace'  => 'battery-surf-bench',
	'capability' => 'manage_options',
	'admin_menu' => array(
		'slug'  => 'battery-surf-bench',
		'icon'  => 'assets/images/menu-icon.png',
		'style' => 'assets/css/admin-menu.css',
	),
);
