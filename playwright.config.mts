/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

import { defineConfig, devices } from '@playwright/test';
import {
	PLAYGROUND_TEST_URL,
	PLAYGROUND_READY_MARKER,
	ADMIN_STORAGE_STATE,
} from './wp-playground/config.mts';

/** Regex that matches the playground ready marker in stdout. */
const readyPattern = new RegExp(
	PLAYGROUND_READY_MARKER.replace( /[[\]]/g, '\\$&' )
);

/**
 * Playwright configuration for Battery Surf Bench e2e tests.
 *
 * Readiness is detected via a stdout marker rather than URL polling, because
 * @wp-playground/cli starts listening before the PHP worker is ready.
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
		wait: { stdout: readyPattern },
		reuseExistingServer: ! process.env.CI,
		timeout: 300_000,
	},

	projects: [
		{
			name: 'setup',
			testDir: './tests/e2e',
			testMatch: /auth\.setup\.mts/,
			use: {
				baseURL: PLAYGROUND_TEST_URL,
				...devices[ 'Desktop Chrome' ],
			},
		},
		{
			name: 'authenticated',
			testDir: './tests/e2e',
			testIgnore: /auth\.setup\.mts/,
			dependencies: [ 'setup' ],
			use: {
				baseURL: PLAYGROUND_TEST_URL,
				storageState: ADMIN_STORAGE_STATE,
				...devices[ 'Desktop Chrome' ],
			},
		},
	],
} );
