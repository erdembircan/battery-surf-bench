import { defineConfig, devices } from '@playwright/test';
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
 * orchestrator process (which starts the webServers below), and again in each
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
 * Resolved the same way as {@link testPort} above, off the second, independent
 * webServer entry (`start-unauth-test.mts`) and its own env var + ready
 * pattern -- see {@link PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR} for why the two
 * servers need distinct capture-group names rather than sharing one.
 */
const unauthPort =
	parsePlaygroundUnauthTestPortEnv(
		process.env[ PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR ]
	) ?? PLAYGROUND_UNAUTH_TEST_PORT;
const unauthBaseUrl = playgroundTestUrl( unauthPort );

/**
 * Playwright configuration for Battery Surf Bench e2e tests.
 *
 * Readiness is detected via a stdout marker rather than URL polling, because
 * `@wp-playground/cli` starts listening before the PHP worker is ready.
 *
 * Two independent, non-persistent WordPress Playground servers back three
 * projects:
 *
 * - The **authenticated** server (`start-test.mts` / `e2eBlueprint`) logs a
 *   fresh browser context in as admin via Playground's own `login` step. The
 *   `setup` project performs a real form login against it once and persists
 *   the session to {@link ADMIN_STORAGE_STATE}; the `authenticated` project
 *   reuses that storage state for every other spec.
 * - The **unauthenticated** server (`start-unauth-test.mts` /
 *   `e2eUnauthenticatedBlueprint`) omits the `login` step entirely, so a
 *   fresh browser context stays genuinely logged out. The `unauthenticated`
 *   project targets it with no `storageState` and no `setup` dependency, to
 *   prove gated admin screens, front-end routes and REST endpoints actually
 *   refuse an anonymous visitor -- something the authenticated server cannot
 *   exercise, since its blueprint auto-promotes any cookie-less request to
 *   admin.
 */
export default defineConfig( {
	/* Fail the build on CI if test.only is left in source code. */
	forbidOnly: !! process.env.CI,

	/* No retries locally; one retry on CI to handle flaky browser tests. */
	retries: process.env.CI ? 1 : 0,

	/* Use a single worker to avoid port conflicts with the playgrounds. */
	workers: 1,

	timeout: 120_000,
	expect: { timeout: 30_000 },

	reporter: process.env.CI ? [ [ 'github' ], [ 'html' ] ] : 'list',

	use: {
		trace: 'retain-on-failure',
	},

	webServer: [
		{
			command: 'npm run playground:test',
			wait: { stdout: PLAYGROUND_READY_PATTERN },
			// `start-test.mts` always resolves a fresh port itself, so anything
			// already listening on it is a foreign process (e.g. another worktree's
			// dev playground that happened to land here), never a legitimate
			// leftover test server. Adopting it would run the suite against the
			// wrong blueprint instead of failing loudly.
			reuseExistingServer: false,
			timeout: 300_000,
		},
		{
			command: 'npm run playground:test:unauth',
			wait: { stdout: PLAYGROUND_UNAUTH_READY_PATTERN },
			reuseExistingServer: false,
			timeout: 300_000,
		},
	],

	projects: [
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
	],
} );
