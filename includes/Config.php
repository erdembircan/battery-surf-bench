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
		// `none` tells WordPress to leave the icon empty so the stylesheet can
		// paint it: admin-menu.css renders the surfer-battery SVG as a
		// `currentColor` mask, letting the icon inherit each colour scheme's
		// menu-icon colours instead of showing a fixed-grey bitmap.
		'icon'  => 'none',
		'style' => 'assets/css/admin-menu.css',
	),
);
