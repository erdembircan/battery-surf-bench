import type {
	BlueprintDeclaration,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import { PLUGIN_SLUG, LIVERELOAD_CLIENT_URL } from './config.mts';

/**
 * Base blueprint options shared by all playground modes. Pins PHP to the
 * project's supported version and tracks the latest WordPress. No extra
 * libraries are requested so boot never depends on fetching wp-cli.phar.
 */
const base = {
	preferredVersions: {
		php: '8.3' as const,
		wp: 'latest',
	},
};

/** Authenticate as the default admin user created by wp-playground. */
const loginStep: BlueprintV1Declaration[ 'steps' ] = [
	{
		step: 'login',
		username: 'admin',
	},
];

/** Enable WordPress debug constants. */
const debugStep: BlueprintV1Declaration[ 'steps' ] = [
	{
		step: 'defineWpConfigConsts',
		consts: {
			WP_DEBUG: true,
			WP_DEBUG_LOG: true,
			WP_DEBUG_DISPLAY: true,
			SCRIPT_DEBUG: true,
		},
	},
];

/**
 * Activate the plugin, which is already mounted via the filesystem. Uses the
 * native `activatePlugin` step (pure PHP) rather than a `wp-cli` command, so
 * boot does not depend on downloading wp-cli.phar.
 */
const activatePluginStep: BlueprintV1Declaration[ 'steps' ] = [
	{
		step: 'activatePlugin',
		pluginPath: `${ PLUGIN_SLUG }/${ PLUGIN_SLUG }.php`,
	},
];

/**
 * Source for a dev-only must-use plugin that enqueues the LiveReload client on
 * the front end and in the admin. Kept out of the shipped plugin so live-reload
 * tooling never leaks into production.
 */
const liveReloadMuPlugin = `<?php
/**
 * Battery Surf Bench dev live reload. Injected by the Playground dev blueprint;
 * enqueues the LiveReload client so editing PHP or rebuilding the JS bundle
 * reloads the browser in place. Never present outside the dev playground.
 */
add_action( 'wp_enqueue_scripts', 'bsb_dev_live_reload' );
add_action( 'admin_enqueue_scripts', 'bsb_dev_live_reload' );
function bsb_dev_live_reload() {
	wp_enqueue_script( 'bsb-live-reload', '${ LIVERELOAD_CLIENT_URL }', array(), null, true );
}
`;

/** Install the dev-only LiveReload mu-plugin. */
const liveReloadStep: BlueprintV1Declaration[ 'steps' ] = [
	{
		step: 'mkdir',
		path: '/wordpress/wp-content/mu-plugins',
	},
	{
		step: 'writeFile',
		path: '/wordpress/wp-content/mu-plugins/bsb-live-reload.php',
		data: liveReloadMuPlugin,
	},
];

/**
 * Development blueprint for a first-run or non-persistent instance. Logs in
 * as admin, enables debug constants, and activates the plugin.
 */
export const devBlueprint: BlueprintDeclaration = {
	...base,
	steps: [
		...loginStep,
		...debugStep,
		...activatePluginStep,
		...liveReloadStep,
	],
};

/**
 * Resume blueprint for an existing persistent installation. Only logs in and
 * re-enables debug constants; the plugin is already active in the persisted
 * database, so activation is skipped.
 */
export const devResumeBlueprint: BlueprintDeclaration = {
	...base,
	steps: [ ...loginStep, ...debugStep, ...liveReloadStep ],
};

/**
 * End-to-end blueprint for a deterministic, non-persistent test instance.
 * Logs in as admin, enables debug constants, and activates the plugin so
 * specs start from a known, plugin-active state.
 */
export const e2eBlueprint: BlueprintDeclaration = {
	...base,
	steps: [ ...loginStep, ...debugStep, ...activatePluginStep ],
};
