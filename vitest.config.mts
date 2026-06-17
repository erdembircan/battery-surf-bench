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
 * The suite is scoped to `src/` so it never walks the downloaded Playground
 * WordPress install or the `.claude/` worktrees, matching the ESLint ignores.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const dataviewsStyle = path.resolve(
	process.cwd(),
	'node_modules/@wordpress/dataviews/build-style/style.css'
);

export default defineConfig( {
	plugins: [ react() ],
	resolve: {
		alias: {
			'dataviews-style.css': dataviewsStyle,
		},
	},
	test: {
		environment: 'jsdom',
		setupFiles: [ './vitest.setup.ts' ],
		include: [ 'src/**/*.test.{ts,tsx}' ],
	},
} );
