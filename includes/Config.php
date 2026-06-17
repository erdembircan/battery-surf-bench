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
	'namespace'   => 'battery-surf-bench',
	'capability'  => 'manage_options',
	'admin_menu'  => array(
		'slug'  => 'battery-surf-bench',
		// `none` tells WordPress to leave the icon empty so the stylesheet can
		// paint it: admin-menu.css renders the surfer-battery SVG as a
		// `currentColor` mask, letting the icon inherit each colour scheme's
		// menu-icon colours instead of showing a fixed-grey bitmap.
		'icon'  => 'none',
		'style' => 'assets/css/admin-menu.css',
	),
	'session'     => array(
		// Post type benchmark sessions are stored as, and the prefix every one
		// of their meta keys is namespaced with. The prefix is bare (no leading
		// underscore) on purpose: protected, underscore-prefixed meta is hidden
		// from REST, and the listing reads the session data over REST.
		'post_type'   => 'bsb_session',
		'meta_prefix' => 'bsb_',
		// Slug of the DataViews listing screen placed under the plugin menu.
		'screen_slug' => 'bsb-sessions',
		// Built assets the listing screen enqueues, relative to the plugin root.
		'bundle'      => 'build/sessions.js',
		'style'       => 'build/style-sessions.css',
	),
	// Meta key marking the pages the plugin seeds (course pages, the cockpit),
	// so re-seeding finds and updates them instead of creating duplicates.
	'page_marker' => '_bsb_seeded',
	'course'      => array(
		// Block Bindings source the cockpit's `pages` attribute binds to.
		'binding_source' => 'bsb/course-pages',
		// Page template course pages request. Empty is the theme's default
		// (full theme chrome); a theme that ships a blank/no-title template
		// could be targeted here, and themes without it fall back natively.
		'template'       => '',
	),
	'cockpit'     => array(
		// Built block directory `register_block_type` reads `block.json` from.
		'block_dir'  => 'build/cockpit',
		// The cockpit block's registered name.
		'block_name' => 'bsb/cockpit',
		// Title of the front-end page the cockpit block is placed on.
		'page_title' => 'Battery Surf Bench',
	),
);
