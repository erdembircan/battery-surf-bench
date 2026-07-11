import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import {
	PLAYGROUND_TEST_PORT,
	PLAYGROUND_TEST_PORT_ENV_VAR,
	PLAYGROUND_READY_PATTERN,
	PLAYGROUND_UNAUTH_TEST_PORT,
	PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR,
	PLAYGROUND_UNAUTH_READY_PATTERN,
	ADMIN_STORAGE_STATE,
	parsePlaygroundTestPortEnv,
	parsePlaygroundUnauthTestPortEnv,
	playgroundTestUrl,
} from './wp-playground/config.mts';

/**
 * The authenticated test playground's port for *this* config evaluation.
 *
 * Playwright evaluates this config file more than once per run: once in the
 * orchestrator process (which starts the webServer below), and again in each
 * worker process it spawns to actually run tests. `start-test.mts` is the
 * only process that binds the socket, so it alone resolves the port -- the
 * orchestrator's `wait.stdout` match against {@link PLAYGROUND_READY_PATTERN}
 * captures that port into `process.env[PLAYGROUND_TEST_PORT_ENV_VAR]`, and
 * worker processes inherit that environment when they reload this file. Two
 * config evaluations each independently resolving their own "free" port would
 * race: the second would see the first's already-bound port as taken and
 * silently pick a different one than the baseURL the first handed out.
 *
 * The env var is unset the one time this matters least -- the orchestrator's
 * own evaluation, before the webServer (and thus the capture) exists -- so it
 * falls back to the preferred base port. That fallback is never actually
 * dialed: the orchestrator only uses this value to declare the webServer and
 * project options, it never navigates a page itself.
 */
const testPort =
	parsePlaygroundTestPortEnv( process.env[ PLAYGROUND_TEST_PORT_ENV_VAR ] ) ??
	PLAYGROUND_TEST_PORT;
const testBaseUrl = playgroundTestUrl( testPort );

/**
 * The unauthenticated test playground's port for *this* config evaluation.
 *
 * Resolved the same way as {@link testPort} above, off the unauthenticated
 * webServer entry (`start-unauth-test.mts`) and its own env var + ready
 * pattern -- see {@link PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR} for why the two
 * servers need distinct capture-group names rather than sharing one, even
 * though (per {@link E2E_TARGET} below) only one of the two ever actually
 * runs in a given invocation.
 */
const unauthPort =
	parsePlaygroundUnauthTestPortEnv(
		process.env[ PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR ]
	) ?? PLAYGROUND_UNAUTH_TEST_PORT;
const unauthBaseUrl = playgroundTestUrl( unauthPort );

/**
 * Which server (and matching project set) this invocation targets.
 *
 * Booting the authenticated and unauthenticated Playground servers
 * concurrently starves both: each `@wp-playground/cli` instance is pinned to
 * 6 PHP workers (see `start-test-server.mts`), so two at once means 12 PHP
 * workers, a webpack build and a headless browser all contending for the same
 * box -- exactly what caused `setup`'s login to time out waiting on
 * `wp-admin`. So exactly one server boots per invocation: `'auth'` (the
 * default, matching every script and CI job that predates the unauthenticated
 * suite) starts only the authenticated server and the `setup`/`authenticated`
 * projects; `'unauth'` starts only the unauthenticated server and the
 * `unauthenticated` project. `package.json`'s `test:e2e`/`test:e2e:unauth`
 * scripts set this, and CI runs them as two separate jobs on two separate
 * runners -- see `.github/workflows/merge-checks.yml`.
 */
const E2E_TARGET: 'auth' | 'unauth' =
	process.env.E2E_TARGET === 'unauth' ? 'unauth' : 'auth';

/** The authenticated Playground server -- started only when {@link E2E_TARGET} is `'auth'`. */
const authWebServer: NonNullable< PlaywrightTestConfig[ 'webServer' ] > = {
	command: 'npm run playground:test',
	wait: { stdout: PLAYGROUND_READY_PATTERN },
	// `start-test.mts` always resolves a fresh port itself, so anything
	// already listening on it is a foreign process (e.g. another worktree's
	// dev playground that happened to land here), never a legitimate
	// leftover test server. Adopting it would run the suite against the
	// wrong blueprint instead of failing loudly.
	reuseExistingServer: false,
	timeout: 300_000,
};

/** The unauthenticated, login-free Playground server -- started only when {@link E2E_TARGET} is `'unauth'`. */
const unauthWebServer: NonNullable< PlaywrightTestConfig[ 'webServer' ] > = {
	command: 'npm run playground:test:unauth',
	wait: { stdout: PLAYGROUND_UNAUTH_READY_PATTERN },
	reuseExistingServer: false,
	timeout: 300_000,
};

/** `setup` + `authenticated` -- the projects that exercise the authenticated server. */
const authProjects: NonNullable< PlaywrightTestConfig[ 'projects' ] > = [
	{
		name: 'setup',
		testDir: './tests/e2e',
		testMatch: /auth\.setup\.mts/,
		use: {
			baseURL: testBaseUrl,
			...devices[ 'Desktop Chrome' ],
		},
	},
	{
		name: 'authenticated',
		testDir: './tests/e2e',
		// Unauth specs are written for the login-free server and would simply
		// fail (or silently pass for the wrong reason) if run here as admin.
		testIgnore: [ /auth\.setup\.mts/, /\.unauth\.spec\.mts$/ ],
		dependencies: [ 'setup' ],
		use: {
			baseURL: testBaseUrl,
			storageState: ADMIN_STORAGE_STATE,
			...devices[ 'Desktop Chrome' ],
		},
	},
];

/** `unauthenticated` -- the sole project that exercises the login-free server. */
const unauthProjects: NonNullable< PlaywrightTestConfig[ 'projects' ] > = [
	{
		name: 'unauthenticated',
		testDir: './tests/e2e',
		testMatch: /\.unauth\.spec\.mts$/,
		use: {
			baseURL: unauthBaseUrl,
			...devices[ 'Desktop Chrome' ],
			// No storageState and no setup dependency: this project drives the
			// login-free server as a genuinely anonymous visitor.
		},
	},
];

/**
 * Playwright configuration for Battery Surf Bench e2e tests.
 *
 * Readiness is detected via a stdout marker rather than URL polling, because
 * `@wp-playground/cli` starts listening before the PHP worker is ready.
 *
 * Exactly one non-persistent WordPress Playground server boots per
 * invocation, selected by {@link E2E_TARGET}:
 *
 * - The **authenticated** server (`start-test.mts` / `e2eBlueprint`) carries
 *   no login step of its own; the `setup` project performs a real form login
 *   against it once and persists the session to {@link ADMIN_STORAGE_STATE},
 *   and the `authenticated` project reuses that storage state for every other
 *   spec.
 * - The **unauthenticated** server (`start-unauth-test.mts` /
 *   `e2eUnauthenticatedBlueprint`) boots the same login-free blueprint, so a
 *   fresh browser context stays genuinely logged out. The `unauthenticated`
 *   project targets it with no `storageState` and no `setup` dependency, to
 *   prove gated admin screens, front-end routes and REST endpoints actually
 *   refuse an anonymous visitor -- something the authenticated server cannot
 *   exercise, since the `setup` project has already authenticated a session
 *   against it.
 *
 * See {@link E2E_TARGET}'s own doc comment for why the two servers never run
 * at once.
 */
export default defineConfig( {
	/* Fail the build on CI if test.only is left in source code. */
	forbidOnly: !! process.env.CI,

	/* No retries locally; one retry on CI to handle flaky browser tests. */
	retries: process.env.CI ? 1 : 0,

	/* Use a single worker to avoid port conflicts with the playground. */
	workers: 1,

	timeout: 120_000,
	expect: { timeout: 30_000 },

	reporter: process.env.CI ? [ [ 'github' ], [ 'html' ] ] : 'list',

	use: {
		trace: 'retain-on-failure',
	},

	webServer: E2E_TARGET === 'unauth' ? unauthWebServer : authWebServer,

	projects: E2E_TARGET === 'unauth' ? unauthProjects : authProjects,
} );
