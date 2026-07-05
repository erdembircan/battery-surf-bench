import { defineConfig, devices } from '@playwright/test';
import {
	PLAYGROUND_TEST_PORT,
	PLAYGROUND_TEST_PORT_ENV_VAR,
	PLAYGROUND_READY_PATTERN,
	ADMIN_STORAGE_STATE,
	parsePlaygroundTestPortEnv,
	playgroundTestUrl,
} from './wp-playground/config.mts';

/**
 * The test playground's port for *this* config evaluation.
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
 * Playwright configuration for Battery Surf Bench e2e tests.
 *
 * Readiness is detected via a stdout marker rather than URL polling, because
 * `@wp-playground/cli` starts listening before the PHP worker is ready.
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

	webServer: {
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
			testIgnore: /auth\.setup\.mts/,
			dependencies: [ 'setup' ],
			use: {
				baseURL: testBaseUrl,
				storageState: ADMIN_STORAGE_STATE,
				...devices[ 'Desktop Chrome' ],
			},
		},
	],
} );
