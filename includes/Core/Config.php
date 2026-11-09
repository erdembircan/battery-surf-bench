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
		// `src/styles/admin/style.scss`.
		'icon'       => 'none',
		'icon_style' => 'build/style-admin-menu.css',
		// Slug of the "Start Benchmark" submenu page, which redirects straight
		// to the cockpit dashboard.
		'start_slug' => 'bsbench-start-benchmark',
		// Nav script that upgrades the rendered submenu link to open the
		// cockpit in a new tab. Built from `src/admin/StartBenchmarkLink.ts`.
		'nav_script' => 'build/admin-start-benchmark.js',
	),
	'settings'   => array(
		// Built assets the settings screen (the top-level menu's page) enqueues,
		// relative to the plugin root. Built from `src/settings/index.tsx`.
		'bundle'     => 'build/settings.js',
		'style'      => 'build/style-settings.css',
		// Option the surfer's test-page sequence is saved under: an ordered,
		// heterogeneous list of `{kind:'bundled',slug}` / `{kind:'user',id}`
		// entries, registered with `show_in_rest` so the settings app reads and
		// writes it through the core-data site-settings entity.
		'option'     => 'bsbench_course_order',
		// Post types the picker's browse pane may add a user page from. A
		// list array — the Registry returns a sequential array leaf as-is,
		// so the plugin's service recipes inject it directly.
		'post_types' => array( 'page', 'post' ),
	),
	'session'    => array(
		// Post type benchmark sessions are stored as, and the prefix every one
		// of their meta keys is namespaced with. The prefix is bare (no leading
		// underscore) on purpose: protected, underscore-prefixed meta is hidden
		// from REST, and the listing reads the session data over REST.
		'post_type'    => 'bsbench_session',
		'meta_prefix'  => 'bsbench_',
		// Slug of the DataViews listing screen placed under the plugin menu.
		'screen_slug'  => 'bsbench-sessions',
		// Slug of the hidden admin page that shows one stored session, and the URL
		// parameter carrying that session's id:
		// `admin.php?page=bsbench-session&bsbenchSessionId=<id>`.
		'detail_slug'  => 'bsbench-session',
		'detail_param' => 'bsbenchSessionId',
		// Built assets the listing screen enqueues, relative to the plugin root.
		'bundle'       => 'build/sessions.js',
		'style'        => 'build/style-sessions.css',
	),
	'course'     => array(
		// Query parameter carrying the opaque, client-incrementing page index:
		// `?bsbenchSurfIndex=<n>`. The client never learns which page an index
		// names, how many pages exist, or anything else about them — the
		// router resolves the index against the saved order server-side
		// (wrapping with modulo) and is the sole authority on what gets
		// served. Never exposed as a per-page slug/URL to the client.
		'index_param'  => 'bsbenchSurfIndex',
		// Query parameter carrying the `bsbench_surf` nonce that authorizes an
		// index request, minted only for the gated cockpit route.
		'nonce_param'  => 'bsbenchNonce',
		// The nonce action the cockpit mints the surf nonce under and the
		// router verifies it against.
		'nonce_action' => 'bsbench_surf',
		// Stylesheet that styles the course content, scoped to its
		// `.bsb-course-content` wrapper, enqueued only on course pages. Built
		// from `src/styles/course/style.scss`.
		'style'        => 'build/style-course.css',
		// The headless surf engine, enqueued only on course pages alongside the
		// stylesheet above. Boots itself only when the traits URL param is
		// present, so a human opening a course URL directly sees a static page.
		// Built from `src/surfer/index.ts`.
		'script'       => 'build/surfer.js',
		// Body-class marker stamped on every page the surf engine actually
		// runs on — both the bundled and the real user pages `CourseRouter`
		// serves through its own controlled synthetic-render route. The
		// cockpit's viewport load guard (`PageGuard.COURSE_PAGE_SELECTOR`)
		// looks for it from inside the iframe.
		'body_class'   => 'bsb-course-page',
	),
	'cockpit'    => array(
		// Query parameter + value that serve the cockpit dashboard:
		// `?bsbenchSession=cockpit`.
		'param'      => 'bsbenchSession',
		'value'      => 'cockpit',
		// Built block directory `register_block_type` reads `block.json` from.
		'block_dir'  => 'build/cockpit',
		// The cockpit block's registered name.
		'block_name' => 'battery-surf-bench/cockpit',
		// Stylesheet for the stripped dashboard, enqueued on the cockpit route
		// and exempted from the dashboard's asset strip so it is the one style
		// that survives. Built from `src/styles/cockpit/style.scss`.
		'style'      => 'build/style-cockpit-dashboard.css',
	),
	'container'  => array(
		// Environments in which the live Services.php is always used and any
		// compiled artifact is ignored, so edits to the recipes take effect
		// immediately. Matched against wp_get_environment_type(). A list array —
		// the Registry returns a sequential array leaf as-is.
		'dev_environments' => array( 'local', 'development' ),
	),
	'devtools'   => array(
		// Environments the dev-tools gate opens for, read against
		// `wp_get_environment_type()`. Anything else (staging, production) keeps
		// the gate closed, so the panel and its script module ship zero bytes.
		// A list array — the Registry returns a sequential array leaf as-is,
		// so the plugin's service recipes inject it directly into `DevTools`.
		'environments' => array( 'local', 'development' ),
		// The dev-tools Interactivity view module, which joins the `battery-surf-bench/cockpit`
		// store to add the battery override. Built from `src/devtools/view.ts`.
		'module'       => 'build/devtools/view.js',
		// Stylesheet for the floating dev-tools panel, spared from the cockpit
		// dashboard's asset strip via the dev-tooling style filter. Built from
		// `src/styles/devtools/style.scss`.
		'style'        => 'build/style-devtools.css',
	),
);
