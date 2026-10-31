// @vitest-environment node

/**
 * Tests for the webpack build configuration in `webpack.config.js`.
 *
 * The plugin does not support right-to-left languages, so the build must not
 * write the rtlcss-mirrored `-rtl.css` stylesheets `@wordpress/scripts` adds
 * by default. The config is loaded the way `pnpm build` runs it, with the
 * experimental modules flag set, and in Vitest's Node environment (the line
 * comment above), since it is build tooling rather than browser code.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

process.env.WP_EXPERIMENTAL_MODULES = 'true';

const load = createRequire( import.meta.url );
const configs = load( '../webpack.config.js' ) as { plugins?: unknown[] }[];
const RtlCssPlugin = load( '@wordpress/scripts/plugins/rtlcss-webpack-plugin' );

describe( 'webpack config', () => {
	it( 'writes no right-to-left stylesheets', () => {
		expect( configs.length ).toBeGreaterThan( 0 );

		for ( const config of configs ) {
			expect(
				( config.plugins ?? [] ).some(
					( plugin ) => plugin instanceof RtlCssPlugin
				)
			).toBe( false );
		}
	} );
} );
