// @vitest-environment node

/**
 * Tests for `DevToolsFlagPlugin`, which defines the `BSB_DEV_TOOLS` build-time
 * constant for the code a config compiles.
 *
 * Each case applies the plugin to a stand-in compiler whose `DefinePlugin`
 * records the definitions it receives. No real build runs.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const load = createRequire( import.meta.url );
const DevToolsFlagPlugin = load( './DevToolsFlagPlugin.cjs' );

/**
 * Applies the plugin to a stand-in compiler and returns what it defined.
 *
 * @param devTools - Whether the build includes the dev-tools panel.
 * @return The definitions handed to the compiler's `DefinePlugin`, and whether that plugin was applied.
 */
function definitionsFor( devTools: boolean ): {
	definitions: Record< string, string >[];
	applied: boolean;
} {
	const definitions: Record< string, string >[] = [];
	let applied = false;

	const compiler = {
		webpack: {
			DefinePlugin: class {
				/**
				 * Records the definitions it is given.
				 *
				 * @param defined - The definitions.
				 */
				constructor( defined: Record< string, string > ) {
					definitions.push( defined );
				}

				/** Records that it was applied. */
				apply(): void {
					applied = true;
				}
			},
		},
	};

	new DevToolsFlagPlugin( devTools ).apply( compiler );

	return { definitions, applied };
}

describe( 'DevToolsFlagPlugin', () => {
	it( 'defines BSB_DEV_TOOLS as true in a development build', () => {
		expect( definitionsFor( true ) ).toEqual( {
			definitions: [ { BSB_DEV_TOOLS: 'true' } ],
			applied: true,
		} );
	} );

	it( 'defines BSB_DEV_TOOLS as false in a production build', () => {
		expect( definitionsFor( false ) ).toEqual( {
			definitions: [ { BSB_DEV_TOOLS: 'false' } ],
			applied: true,
		} );
	} );
} );
