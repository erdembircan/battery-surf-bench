import type {
	BlueprintDeclaration,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import { PLUGIN_SLUG, liveReloadClientUrl } from './config.mts';

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

/**
 * Enable WordPress debug constants. `WP_ENVIRONMENT_TYPE` also opens the
 * plugin's own dev-tools gate ({@see DevTools}): every blueprint below shares
 * this step, so the dev-only battery-override panel is available wherever
 * these blueprints run, including the e2e suite, which needs it to exercise the
 * override without a real unplug. The constant wins over any system env var
 * `wp_get_environment_type()` also reads.
 */
const debugStep: BlueprintV1Declaration[ 'steps' ] = [
	{
		step: 'defineWpConfigConsts',
		consts: {
			WP_DEBUG: true,
			WP_DEBUG_LOG: true,
			WP_DEBUG_DISPLAY: true,
			SCRIPT_DEBUG: true,
			WP_ENVIRONMENT_TYPE: 'development',
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
 * tooling never leaks into production. The cockpit dashboard strips every
 * classic front-end script, so the client also opts into the cockpit's
 * `battery_surf_bench_cockpit_spared_script_handles` filter to survive that strip and keep
 * reloading the cockpit in place.
 */
/**
 * Build the dev-only LiveReload mu-plugin PHP source for a resolved client URL.
 *
 * @param clientUrl - The `livereload.js` client URL to enqueue.
 * @return The mu-plugin PHP source.
 */
const liveReloadMuPlugin = ( clientUrl: string ) => `<?php
/**
 * Battery Surf Bench dev live reload. Injected by the Playground dev blueprint;
 * enqueues the LiveReload client so editing PHP or rebuilding the JS bundle
 * reloads the browser in place. Never present outside the dev playground.
 */
add_action( 'wp_enqueue_scripts', 'bsb_dev_live_reload' );
add_action( 'admin_enqueue_scripts', 'bsb_dev_live_reload' );
function bsb_dev_live_reload() {
	wp_enqueue_script( 'bsb-live-reload', '${ clientUrl }', array(), null, true );
}

// The cockpit dashboard strips every classic front-end script; spare the
// LiveReload client so editing files still reloads the cockpit in place.
add_filter( 'battery_surf_bench_cockpit_spared_script_handles', 'bsb_dev_live_reload_spare' );
function bsb_dev_live_reload_spare( $handles ) {
	$handles[] = 'bsb-live-reload';
	return $handles;
}
`;

/**
 * Build the dev-only LiveReload mu-plugin install step for a resolved port.
 *
 * @param liveReloadPort - The port the LiveReload server bound this run.
 * @return The mkdir + writeFile steps that install the mu-plugin.
 */
const liveReloadStep = (
	liveReloadPort: number
): NonNullable< BlueprintV1Declaration[ 'steps' ] > => [
	{
		step: 'mkdir',
		path: '/wordpress/wp-content/mu-plugins',
	},
	{
		step: 'writeFile',
		path: '/wordpress/wp-content/mu-plugins/bsb-live-reload.php',
		data: liveReloadMuPlugin( liveReloadClientUrl( liveReloadPort ) ),
	},
];

/**
 * Build the development blueprint for a first-run or non-persistent instance.
 * Logs in as admin, enables debug constants, activates the plugin, and installs
 * the LiveReload mu-plugin pointed at the resolved port.
 *
 * @param liveReloadPort - The port the LiveReload server bound this run.
 * @return The blueprint declaration.
 */
export const devBlueprint = (
	liveReloadPort: number
): BlueprintDeclaration => ( {
	...base,
	steps: [
		...loginStep,
		...debugStep,
		...activatePluginStep,
		...liveReloadStep( liveReloadPort ),
	],
} );

/**
 * Build the resume blueprint for an existing persistent installation. Only logs
 * in, re-enables debug constants, and reinstalls the LiveReload mu-plugin
 * pointed at the resolved port; the plugin is already active in the persisted
 * database, so activation is skipped.
 *
 * @param liveReloadPort - The port the LiveReload server bound this run.
 * @return The blueprint declaration.
 */
export const devResumeBlueprint = (
	liveReloadPort: number
): BlueprintDeclaration => ( {
	...base,
	steps: [ ...loginStep, ...debugStep, ...liveReloadStep( liveReloadPort ) ],
} );

/**
 * End-to-end blueprint for a deterministic, non-persistent test instance.
 * Logs in as admin, enables debug constants, and activates the plugin so
 * specs start from a known, plugin-active state.
 */
export const e2eBlueprint: BlueprintDeclaration = {
	...base,
	steps: [ ...loginStep, ...debugStep, ...activatePluginStep ],
};
