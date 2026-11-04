// @vitest-environment node

/**
 * Tests for `StyleOnlyEntriesPlugin`, which removes the scripts webpack writes
 * for stylesheet-only entries.
 *
 * Each case runs the plugin against a stand-in for webpack's compiler and
 * compilation: the hooks it taps, the entries it reads and the assets it
 * deletes. No real build runs.
 */

import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const load = createRequire( import.meta.url );
const StyleOnlyEntriesPlugin = load( './StyleOnlyEntriesPlugin.cjs' );

/** Webpack's stage for analysing assets, where the dependency extraction writes its asset files. */
const ANALYSE_STAGE = 4000;

/** Webpack's stage for reporting on finished assets. */
const REPORT_STAGE = 5000;

/**
 * Runs the plugin over a compilation with the given entries.
 *
 * @param entries - Each entry's name, mapped to the requests of the modules it starts from.
 * @return The assets the plugin deleted, in order, and the stage it ran at.
 */
function run( entries: Record< string, string[] > ): {
	deleted: string[];
	stage: number;
} {
	const deleted: string[] = [];
	let stage = -1;
	let processAssets = (): void => {};

	const compilation = {
		entries: new Map(
			Object.entries( entries ).map( ( [ name, requests ] ) => [
				name,
				{
					dependencies: requests.map( ( request ) => ( {
						request,
					} ) ),
				},
			] )
		),
		hooks: {
			processAssets: {
				tap: ( options: { stage: number }, callback: () => void ) => {
					stage = options.stage;
					processAssets = callback;
				},
			},
		},
		deleteAsset: ( name: string ) => {
			deleted.push( name );
		},
	};

	const compiler = {
		webpack: {
			Compilation: {
				PROCESS_ASSETS_STAGE_ANALYSE: ANALYSE_STAGE,
				PROCESS_ASSETS_STAGE_REPORT: REPORT_STAGE,
			},
		},
		hooks: {
			thisCompilation: {
				tap: (
					name: string,
					callback: ( current: typeof compilation ) => void
				) => callback( compilation ),
			},
		},
	};

	new StyleOnlyEntriesPlugin().apply( compiler );
	processAssets();

	return { deleted, stage };
}

describe( 'StyleOnlyEntriesPlugin', () => {
	it( 'deletes the script and asset file of a stylesheet-only entry', () => {
		expect(
			run( { 'admin-menu': [ '/src/styles/admin/style.scss' ] } ).deleted
		).toEqual( [ 'admin-menu.js', 'admin-menu.asset.php' ] );
	} );

	it( 'treats plain CSS and Sass stylesheets alike', () => {
		expect(
			run( { plain: [ '/a/style.css' ], indented: [ '/b/style.sass' ] } )
				.deleted
		).toEqual( [
			'plain.js',
			'plain.asset.php',
			'indented.js',
			'indented.asset.php',
		] );
	} );

	it( 'keeps an entry that starts from a script', () => {
		expect(
			run( { sessions: [ '/src/sessions/index.tsx' ] } ).deleted
		).toEqual( [] );
	} );

	it( 'keeps an entry that mixes a script with a stylesheet', () => {
		expect(
			run( { mixed: [ '/c/style.scss', '/c/index.ts' ] } ).deleted
		).toEqual( [] );
	} );

	it( 'runs after the dependency extraction writes its asset files', () => {
		expect( run( {} ).stage ).toBeGreaterThan( ANALYSE_STAGE );
	} );
} );
