/**
 * Vitest configuration for the JS/TS unit suite.
 *
 * Mirrors the parts of the webpack build the tests rely on: the React JSX
 * runtime (so `.tsx` renders), a jsdom DOM for React Testing Library, and the
 * `dataviews-style.css` alias the screen bundle uses to pull in the DataViews
 * stylesheet. Stylesheet imports are side effects with no behavior to assert,
 * so Vitest's default CSS handling replaces them with empty modules — `.scss`
 * needs no Sass toolchain here.
 *
 * The screen imports the slim `@wordpress/dataviews` build, whose modules
 * unlock `@wordpress/components`' private APIs against the `wp.privateApis`
 * global WordPress core locks at runtime. Under Vitest there is no such global,
 * and pnpm resolves separate `@wordpress/private-apis` copies for dataviews and
 * components, so that unlock throws. The bare specifier is therefore aliased to
 * the self-contained `@wordpress/dataviews/wp` build, which locks and unlocks
 * its own bundled copies internally — identical public surface (so the real
 * `filterSortAndPaginate` still drives the asserted sort), no external global.
 *
 * The suite is scoped to `src/`, `wp-playground/` and `bin/` so it never walks
 * the downloaded Playground WordPress install or the `.claude/` worktrees,
 * matching the ESLint ignores.
 *
 * Runs on Vitest's `threads` pool rather than the `forks` default: workers
 * are cheaper to spin up than child processes, which cuts per-file startup
 * overhead across 60+ test files and measurably speeds up the suite with all
 * 642 tests still passing. `maxWorkers` is CI-aware — locally it claims every
 * core (`'100%'`) since agents run this before pushing and local speed
 * matters, while on CI it's left `undefined` so Vitest falls back to its own
 * default and tracks whatever the runner actually has.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const dataviewsStyle = path.resolve(
	process.cwd(),
	'node_modules/@wordpress/dataviews/build-style/style.css'
);

const dataviewsSelfContained = path.resolve(
	process.cwd(),
	'node_modules/@wordpress/dataviews/build-wp/index.js'
);

export default defineConfig( {
	plugins: [ react() ],
	resolve: {
		alias: [
			{ find: 'dataviews-style.css', replacement: dataviewsStyle },
			{
				find: /^@wordpress\/dataviews$/,
				replacement: dataviewsSelfContained,
			},
			{
				find: /^@\//,
				replacement: path.resolve( process.cwd(), 'src' ) + '/',
			},
		],
	},
	test: {
		environment: 'jsdom',
		setupFiles: [ './vitest.setup.ts' ],
		include: [
			'src/**/*.test.{ts,tsx}',
			'wp-playground/**/*.test.{ts,mts}',
			'bin/**/*.test.mts',
		],
		pool: 'threads',
		maxWorkers: process.env.CI ? undefined : '100%',
	},
} );
