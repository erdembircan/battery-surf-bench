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
		'slug'       => 'battery-surf-bench',
		// `none` tells WordPress to leave the icon empty so the stylesheet can
		// paint it: the admin-menu style renders the surfer-battery SVG as a
		// `currentColor` mask, letting the icon inherit each colour scheme's
		// menu-icon colours instead of showing a fixed-grey bitmap. Built from
		// `src/admin/style.scss`.
		'icon'       => 'none',
		'style'      => 'build/style-admin-menu.css',
		// Slug of the "Start Benchmark" submenu page, which redirects straight
		// to the cockpit dashboard.
		'start_slug' => 'bsb-start-benchmark',
		// Nav script that upgrades the rendered submenu link to open the
		// cockpit in a new tab. Built from `src/admin/StartBenchmarkLink.ts`.
		'nav_script' => 'build/admin-start-benchmark.js',
	),
	'session'    => array(
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
	'course'     => array(
		// Query parameter that selects a course page: `?bsbSessionPage=<slug>`.
		// The router renders the named page through the active theme; nothing
		// is seeded as a real page.
		'param'          => 'bsbSessionPage',
		// Block Bindings source the cockpit's `pages` attribute binds to.
		'binding_source' => 'bsb/course-pages',
		// Stylesheet that styles the course content, scoped to its
		// `.bsb-course-content` wrapper, enqueued only on course pages. Built
		// from `src/course/style.scss`.
		'style'          => 'build/style-course.css',
		// The headless surf engine, enqueued only on course pages alongside the
		// stylesheet above. Boots itself only when the traits URL param is
		// present, so a human opening a course URL directly sees a static page.
		// Built from `src/surfer/index.ts`.
		'script'         => 'build/surfer.js',
	),
	'cockpit'    => array(
		// Query parameter + value that serve the cockpit dashboard:
		// `?bsbSession=cockpit`.
		'param'      => 'bsbSession',
		'value'      => 'cockpit',
		// Built block directory `register_block_type` reads `block.json` from.
		'block_dir'  => 'build/cockpit',
		// The cockpit block's registered name.
		'block_name' => 'bsb/cockpit',
		// Stylesheet for the stripped dashboard, enqueued on the cockpit route
		// and exempted from the dashboard's asset strip so it is the one style
		// that survives. Built from `src/cockpit/style.scss`.
		'style'      => 'build/style-cockpit-dashboard.css',
	),
	'devtools'   => array(
		// Environments the dev-tools gate opens for, read against
		// `wp_get_environment_type()`. Anything else (staging, production) keeps
		// the gate closed, so the panel and its script module ship zero bytes.
		// Comma-separated: the Registry only ever resolves scalars, never an
		// array, so the bootstrap splits this into the list `DevTools` receives.
		'environments' => 'local,development',
		// The dev-tools Interactivity view module, which joins the `bsb/cockpit`
		// store to add the battery override. Built from `src/devtools/view.ts`.
		'module'       => 'build/devtools/view.js',
		// Stylesheet for the floating dev-tools panel, spared from the cockpit
		// dashboard's asset strip via the dev-tooling style filter. Built from
		// `src/devtools/style.scss`.
		'style'        => 'build/style-devtools.css',
	),
);
