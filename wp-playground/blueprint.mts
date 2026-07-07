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
 * Source for a dev-only must-use plugin that logs the browser in as the
 * default admin user, deterministically and without a redirect.
 *
 * The pinned `@wp-playground/cli` (3.1.39) flips its HTTP server's ready flag
 * before the blueprint's `login` step has run, so the constant that step
 * defines for Playground's own bundled auto-login mu-plugin is not yet set
 * when the first real browser requests land — that mu-plugin then finds no
 * constant, does nothing, and there is no retry, so the dev server serves a
 * logged-out page. Even once defined, that bundled mu-plugin authenticates via
 * a 302 redirect, which fights the LiveReload proxy. This mu-plugin sidesteps
 * both problems: it is written straight to the persisted mu-plugins directory
 * (so on every run after the first it is on disk and active before the server
 * even boots, entirely outside the ready-flag race) and it authenticates the
 * current request directly with `wp_set_current_user()` plus `wp_set_auth_cookie()`
 * instead of redirecting.
 */
export const autoLoginMuPlugin = `<?php
/**
 * Battery Surf Bench dev auto-login. Injected by the Playground dev blueprint so
 * the persistent dev server serves an authenticated admin session to the browser
 * without a manual wp-login.php round-trip. Never present outside the dev
 * playground: it is written only by the dev blueprints and additionally guards on
 * the development environment type.
 */
add_action( 'init', 'bsb_dev_auto_login', 0 );
function bsb_dev_auto_login() {
	// Defense in depth: only ever act inside the development playground.
	if ( 'development' !== wp_get_environment_type() ) {
		return;
	}
	// REST/AJAX requests authenticate via the cookie + nonce already; setting a
	// cookie on those responses is pointless and noisy.
	if ( wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return;
	}
	if ( is_user_logged_in() ) {
		return;
	}
	$user = get_user_by( 'login', 'admin' );
	if ( ! $user ) {
		return;
	}
	// Authenticate the current request so the first rendered page is admin.
	wp_set_current_user( $user->ID, $user->user_login );
	// Persist the session for subsequent requests (and the page's REST XHRs).
	// Only settable before headers are sent; on a normal page load init is early
	// enough. If headers are already out, the current-user set above still makes
	// this page render authenticated and the next request will re-enter here.
	if ( ! headers_sent() ) {
		wp_set_auth_cookie( $user->ID );
	}
	// wp_set_auth_cookie() only takes effect on the *next* request, but
	// auth_redirect() validates the cookie on the *current* one -- so a first,
	// direct hit to /wp-admin/ (which carries no cookie yet) would bounce to
	// wp-login. Seed the request superglobal with freshly generated cookies so
	// this very request is already authenticated and wp-admin renders in place,
	// without the login redirect that also fights the LiveReload client.
	$expiration  = time() + 2 * DAY_IN_SECONDS;
	$secure      = is_ssl();
	$auth_cookie = $secure ? SECURE_AUTH_COOKIE : AUTH_COOKIE;
	$auth_scheme = $secure ? 'secure_auth' : 'auth';
	$_COOKIE[ $auth_cookie ]     = wp_generate_auth_cookie( $user->ID, $expiration, $auth_scheme );
	$_COOKIE[ LOGGED_IN_COOKIE ] = wp_generate_auth_cookie( $user->ID, $expiration, 'logged_in' );
}
`;

/**
 * Build the dev-only auto-login mu-plugin install step.
 *
 * @return The mkdir + writeFile steps that install the mu-plugin.
 */
export const autoLoginStep = (): NonNullable<
	BlueprintV1Declaration[ 'steps' ]
> => [
	{
		step: 'mkdir',
		path: '/wordpress/wp-content/mu-plugins',
	},
	{
		step: 'writeFile',
		path: '/wordpress/wp-content/mu-plugins/bsb-dev-auto-login.php',
		data: autoLoginMuPlugin,
	},
];

/**
 * Build the development blueprint for a first-run or non-persistent instance.
 * Enables debug constants, activates the plugin, installs the dev auto-login
 * mu-plugin, and installs the LiveReload mu-plugin pointed at the resolved
 * port. Does not use the shared `login` step — see {@link autoLoginMuPlugin}
 * for why the dev server needs its own auto-login path instead.
 *
 * @param liveReloadPort - The port the LiveReload server bound this run.
 * @return The blueprint declaration.
 */
export const devBlueprint = (
	liveReloadPort: number
): BlueprintDeclaration => ( {
	...base,
	steps: [
		...debugStep,
		...activatePluginStep,
		...autoLoginStep(),
		...liveReloadStep( liveReloadPort ),
	],
} );

/**
 * Build the resume blueprint for an existing persistent installation.
 * Re-enables debug constants and reinstalls the dev auto-login and LiveReload
 * mu-plugins pointed at the resolved port; the plugin is already active in the
 * persisted database, so activation is skipped. Does not use the shared
 * `login` step — see {@link autoLoginMuPlugin} for why the dev server needs
 * its own auto-login path instead.
 *
 * @param liveReloadPort - The port the LiveReload server bound this run.
 * @return The blueprint declaration.
 */
export const devResumeBlueprint = (
	liveReloadPort: number
): BlueprintDeclaration => ( {
	...base,
	steps: [
		...debugStep,
		...autoLoginStep(),
		...liveReloadStep( liveReloadPort ),
	],
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
