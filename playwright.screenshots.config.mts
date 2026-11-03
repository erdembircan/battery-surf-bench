import { defineConfig, devices } from '@playwright/test';
import {
	PLAYGROUND_SCREENSHOTS_PORT,
	PLAYGROUND_SCREENSHOTS_PORT_ENV_VAR,
	PLAYGROUND_SCREENSHOTS_READY_PATTERN,
	SCREENSHOTS_STORAGE_STATE,
	parsePlaygroundScreenshotsPortEnv,
	playgroundTestUrl,
} from './wp-playground/config.mts';

/**
 * The screenshot playground's port for *this* config evaluation.
 *
 * Resolved the way `playwright.config.mts` resolves its test ports: the
 * orchestrator's `wait.stdout` match against the ready pattern captures the
 * port `StartScreenshots.mts` bound into `process.env`, and worker processes
 * inherit it when they re-evaluate this file. Before the webServer exists the
 * variable is unset and the preferred port stands in; it is never dialed.
 */
const screenshotsPort =
	parsePlaygroundScreenshotsPortEnv(
		process.env[ PLAYGROUND_SCREENSHOTS_PORT_ENV_VAR ]
	) ?? PLAYGROUND_SCREENSHOTS_PORT;
const baseURL = playgroundTestUrl( screenshotsPort );

/**
 * Playwright configuration for `pnpm screenshots`, which retakes the
 * WordPress.org listing screenshots in `.wordpress-org/`.
 *
 * It is not a test suite, and CI never runs it. It boots its own Playground
 * server (`screenshotsBlueprint`, production environment type), logs in once
 * in a setup project, then runs the capture spec in `tests/screenshots/` at
 * 1440 × 900 CSS pixels and a device scale factor of 2. The timeout is long
 * because the mid-run cockpit shot waits on real time: the cockpit computes
 * its drain rates from real elapsed time.
 */
export default defineConfig( {
	forbidOnly: true,
	retries: 0,
	workers: 1,

	timeout: 2_700_000,
	expect: { timeout: 30_000 },

	reporter: 'list',

	use: {
		trace: 'retain-on-failure',
	},

	webServer: {
		command: 'npm run playground:screenshots',
		wait: { stdout: PLAYGROUND_SCREENSHOTS_READY_PATTERN },
		reuseExistingServer: false,
		timeout: 300_000,
	},

	projects: [
		{
			name: 'setup',
			testDir: './tests/screenshots',
			testMatch: /Login\.setup\.mts/,
			use: {
				baseURL,
				...devices[ 'Desktop Chrome' ],
			},
		},
		{
			name: 'screenshots',
			testDir: './tests/screenshots',
			testMatch: /\.spec\.mts$/,
			dependencies: [ 'setup' ],
			use: {
				baseURL,
				storageState: SCREENSHOTS_STORAGE_STATE,
				...devices[ 'Desktop Chrome' ],
				viewport: { width: 1440, height: 900 },
				deviceScaleFactor: 2,
				locale: 'en-US',
				timezoneId: 'UTC',
				colorScheme: 'light',
			},
		},
	],
} );
