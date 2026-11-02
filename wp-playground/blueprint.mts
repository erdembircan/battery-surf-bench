import type {
	BlueprintDeclaration,
	BlueprintV1Declaration,
} from '@wp-playground/blueprints';
import { PLUGIN_SLUG, liveReloadClientUrl } from './config.mts';

/**
 * Base blueprint options shared by all playground modes. Pins PHP to the
 * project's supported version and installs the latest WordPress release.
 * `latest` is resolved only when WordPress is downloaded: the e2e instances
 * download it on every run, while the persistent dev site downloads it once
 * and from then on is kept current by WordPress's own background updater,
 * which installs every release, major ones included (the default since
 * WordPress 5.6). That updater only runs while the dev server is up, so after
 * a release lands while the server is off, the site boots on the previous
 * version and updates itself once its twice-daily update check comes due. No
 * extra libraries are requested so boot never depends on fetching wp-cli.phar.
 */
const base = {
	preferredVersions: {
		php: '8.3' as const,
		wp: 'latest',
	},
};

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
 * Pin the persistent dev site to the default English (US) locale on every
 * boot. The site language lives in the persisted database, so switching the
 * dev site to another locale (for example to check one of the plugin's own
 * translations) used to stick across restarts and greet every later run in
 * that language. An empty `WPLANG` is how WordPress stores en_US. Uses
 * `setSiteOptions` rather than `setSiteLanguage`, which would fetch a
 * translation package over the network. Switching languages mid-session
 * still works; the next start resets it.
 */
const siteLanguageStep: BlueprintV1Declaration[ 'steps' ] = [
	{
		step: 'setSiteOptions',
		options: {
			WPLANG: '',
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
 * Source for a dev/e2e-only must-use plugin that stubs YouTube's oEmbed
 * response for a `youtube.com/watch?v=` URL, returning a canned
 * `youtube.com/embed/...` iframe shaped exactly like YouTube's real oEmbed
 * `html` field.
 *
 * wp-playground (both the persistent dev server and the non-persistent e2e
 * instances) has no reliable outbound network, so WordPress's REAL
 * `pre_oembed_result`/oEmbed HTTP fetch for a YouTube URL returns nothing —
 * no iframe is produced, and there is nothing for the plugin's own,
 * production `YouTubeEmbed::embed_oembed_html()` amend
 * (`includes/Course/YouTubeEmbed.php`) to act on. This mu-plugin exists
 * solely to make that upstream fetch succeed deterministically inside
 * Playground, so the real, unmodified production amend still runs against
 * something to amend. It is never shipped: the production plugin carries no
 * such stub, and `YouTubeEmbed` never short-circuits WordPress's own oEmbed
 * handling.
 */
export const youtubeOembedStubMuPlugin = `<?php
/**
 * Battery Surf Bench dev/e2e YouTube oEmbed stub. Injected by the Playground
 * blueprints so a YouTube embed resolves deterministically without a real
 * network request — wp-playground has no reliable outbound network. Never
 * present outside Playground: the shipped plugin carries no such stub and
 * relies entirely on WordPress's own real oEmbed handling.
 */
add_filter( 'pre_oembed_result', 'bsb_youtube_oembed_stub', 10, 2 );
function bsb_youtube_oembed_stub( $result, $url ) {
	if ( ! preg_match( '#youtube\\.com/watch\\?(?:.*&)?v=([A-Za-z0-9_-]{11})#', $url, $matches ) ) {
		return $result;
	}

	$id = $matches[1];

	return '<iframe width="200" height="113" src="https://www.youtube.com/embed/' . $id . '?feature=oembed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>';
}
`;

/**
 * Build the dev/e2e-only YouTube oEmbed stub mu-plugin install step.
 *
 * @return The mkdir + writeFile steps that install the mu-plugin.
 */
export const youtubeOembedStubStep = (): NonNullable<
	BlueprintV1Declaration[ 'steps' ]
> => [
	{
		step: 'mkdir',
		path: '/wordpress/wp-content/mu-plugins',
	},
	{
		step: 'writeFile',
		path: '/wordpress/wp-content/mu-plugins/bsb-youtube-oembed-stub.php',
		data: youtubeOembedStubMuPlugin,
	},
];

/**
 * Build the development blueprint for a first-run or non-persistent instance.
 * Enables debug constants, pins the site language to English (see
 * {@link siteLanguageStep}), activates the plugin, installs the dev
 * auto-login mu-plugin, installs the YouTube oEmbed stub (so the video course
 * page renders a real, controllable embed without needing outbound network —
 * see {@link youtubeOembedStubMuPlugin}), and installs the LiveReload
 * mu-plugin pointed at the resolved port. Does not use the shared `login`
 * step — see {@link autoLoginMuPlugin} for why the dev server needs its own
 * auto-login path instead.
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
		...siteLanguageStep,
		...activatePluginStep,
		...autoLoginStep(),
		...youtubeOembedStubStep(),
		...liveReloadStep( liveReloadPort ),
	],
} );

/**
 * Build the resume blueprint for an existing persistent installation.
 * Re-enables debug constants, resets the site language to English (see
 * {@link siteLanguageStep}), and reinstalls the dev auto-login, YouTube
 * oEmbed stub and LiveReload mu-plugins pointed at the resolved port; the
 * plugin is already active in the persisted database, so activation is
 * skipped. Does not use the shared `login` step — see {@link autoLoginMuPlugin}
 * for why the dev server needs its own auto-login path instead.
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
		...siteLanguageStep,
		...autoLoginStep(),
		...youtubeOembedStubStep(),
		...liveReloadStep( liveReloadPort ),
	],
} );

/**
 * End-to-end blueprint for a deterministic, non-persistent test instance.
 * Enables debug constants and activates the plugin so specs start from a
 * known, plugin-active state. Also installs the YouTube oEmbed stub (see
 * {@link youtubeOembedStubMuPlugin}), so `CockpitCourse.spec.mts`'s video
 * course page coverage exercises the real, unmodified production
 * `YouTubeEmbed::embed_oembed_html()` amend against a real (stubbed) oEmbed
 * response instead of needing outbound network. Carries no login step: the
 * pinned `@wp-playground/cli` (3.1.39) races that step's bundled auto-login
 * mu-plugin against the server's own ready flag (see {@link autoLoginMuPlugin}),
 * which made a cookie-less request to `wp-login.php` nondeterministic — the
 * only place that happens is `auth.setup.mts`, which drives a real form login
 * itself. Authentication for the `authenticated` Playwright project comes
 * entirely from the `storageState` that setup project saves after that login;
 * nothing here needs to pre-authenticate the server.
 */
export const e2eBlueprint: BlueprintDeclaration = {
	...base,
	steps: [ ...debugStep, ...activatePluginStep, ...youtubeOembedStubStep() ],
};

/**
 * End-to-end blueprint for a deterministic, non-persistent test instance that
 * is never authenticated. Its steps are the same as {@link e2eBlueprint} —
 * neither carries a login step — so what actually keeps this server anonymous
 * is that no Playwright project targeting it ever drives a form login or
 * loads a `storageState`, unlike the `authenticated` project's `auth.setup.mts`.
 * Backs the `unauthenticated` Playwright project, which drives gated surfaces
 * as an anonymous visitor to prove they are actually refused.
 */
export const e2eUnauthenticatedBlueprint: BlueprintDeclaration = {
	...base,
	steps: [ ...debugStep, ...activatePluginStep ],
};
