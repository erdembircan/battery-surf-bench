// @vitest-environment node

/**
 * Tests for the webpack build configuration in `webpack.config.js`.
 *
 * The plugin does not support right-to-left languages, so the build must not
 * write the rtlcss-mirrored `-rtl.css` stylesheets `@wordpress/scripts` adds
 * by default. Nor may it write files nothing loads: a placeholder bundle, or
 * the scripts of stylesheet-only entries. A production build must leave the
 * dev-tools panel out, and a development build must compile it in. The config
 * is loaded the way `pnpm run assets:production` and
 * `pnpm run assets:development` run it, with the experimental modules flag set,
 * and in Vitest's Node environment (the line comment above), since it is build
 * tooling rather than browser code.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

interface WebpackConfig {
	entry?: object | ( () => Promise< object > );
	plugins?: unknown[];
}

const load = createRequire( import.meta.url );
const RtlCssPlugin = load( '@wordpress/scripts/plugins/rtlcss-webpack-plugin' );
const StyleOnlyEntriesPlugin = load( './StyleOnlyEntriesPlugin.cjs' );
const DevToolsFlagPlugin = load( './DevToolsFlagPlugin.cjs' );

/**
 * Loads the webpack config the way a build of one variant runs it.
 *
 * @param devTools - Whether to load it as a development build, with `BSB_DEV_TOOLS` set.
 * @return The configs the file exports.
 */
function loadConfigs( devTools: boolean ): WebpackConfig[] {
	process.env.WP_EXPERIMENTAL_MODULES = 'true';

	if ( devTools ) {
		process.env.BSB_DEV_TOOLS = 'true';
	} else {
		delete process.env.BSB_DEV_TOOLS;
	}

	const configFile = load.resolve( '../webpack.config.js' );
	delete load.cache[ configFile ];

	return load( configFile ) as WebpackConfig[];
}

const production = loadConfigs( false );
const development = loadConfigs( true );
delete process.env.BSB_DEV_TOOLS;

/**
 * Returns the entry names a config resolves to, calling through an entry
 * function the way webpack does.
 *
 * @param config - A webpack config.
 * @return The config's entry names.
 */
async function entryNames( config: WebpackConfig ): Promise< string[] > {
	const entry =
		typeof config.entry === 'function'
			? await config.entry()
			: config.entry;

	return Object.keys( entry ?? {} );
}

/**
 * Returns the `BSB_DEV_TOOLS` definitions a config's `DevToolsFlagPlugin`
 * hands to a stand-in compiler.
 *
 * @param config - A webpack config.
 * @return The value each of the config's flag plugins defines.
 */
function devToolsDefinitions( config: WebpackConfig ): string[] {
	const definitions: string[] = [];
	const compiler = {
		webpack: {
			DefinePlugin: class {
				/**
				 * Records the value defined for `BSB_DEV_TOOLS`.
				 *
				 * @param defined - The definitions.
				 */
				constructor( defined: Record< string, string > ) {
					definitions.push( defined.BSB_DEV_TOOLS );
				}

				/** Does nothing: nothing is compiled. */
				apply(): void {}
			},
		},
	};

	for ( const plugin of config.plugins ?? [] ) {
		if ( plugin instanceof DevToolsFlagPlugin ) {
			( plugin as { apply: ( target: object ) => void } ).apply(
				compiler
			);
		}
	}

	return definitions;
}

describe( 'webpack config', () => {
	it( 'writes no right-to-left stylesheets', () => {
		expect( production.length ).toBeGreaterThan( 0 );

		for ( const config of [ ...production, ...development ] ) {
			expect(
				( config.plugins ?? [] ).some(
					( plugin ) => plugin instanceof RtlCssPlugin
				)
			).toBe( false );
		}
	} );

	it( 'builds no placeholder bundle', async () => {
		expect( await entryNames( production[ 0 ] ) ).not.toContain( 'index' );
	} );

	it( 'drops the scripts of stylesheet-only entries', () => {
		expect(
			( production[ 0 ].plugins ?? [] ).some(
				( plugin ) => plugin instanceof StyleOnlyEntriesPlugin
			)
		).toBe( true );
	} );

	it( 'leaves the dev-tools panel out of a production build', async () => {
		expect( await entryNames( production[ 0 ] ) ).not.toContain(
			'devtools'
		);
		expect( await entryNames( production[ 1 ] ) ).not.toContain(
			'devtools/view'
		);
	} );

	it( 'compiles the dev-tools panel into a development build', async () => {
		expect( await entryNames( development[ 0 ] ) ).toContain( 'devtools' );
		expect( await entryNames( development[ 1 ] ) ).toContain(
			'devtools/view'
		);
	} );

	it( 'defines BSB_DEV_TOOLS in every config to match the build', () => {
		for ( const config of production ) {
			expect( devToolsDefinitions( config ) ).toEqual( [ 'false' ] );
		}

		for ( const config of development ) {
			expect( devToolsDefinitions( config ) ).toEqual( [ 'true' ] );
		}
	} );
} );
