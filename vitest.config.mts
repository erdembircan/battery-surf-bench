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
		],
	},
	test: {
		environment: 'jsdom',
		setupFiles: [ './vitest.setup.ts' ],
		include: [ 'src/**/*.test.{ts,tsx}' ],
	},
} );
