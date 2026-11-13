/**
 * Tests for the Live Preview blueprint checks in `LivePreviewBlueprint.mts`.
 *
 * Every case is a blueprint held in memory, with no filesystem, run through the
 * real Playground blueprint schema.
 */

import { describe, it, expect } from 'vitest';
import {
	BLUEPRINT_SIZE_LIMIT,
	findBlueprintErrors,
} from './LivePreviewBlueprint.mts';

const SLUG = 'battery-surf-bench';

const OBJECT_MESSAGE =
	'It must be a JSON object, the shape of a Playground blueprint.';

const INSTALL_MESSAGE = `It has no installPlugin step that installs and activates ${ SLUG } from wordpress.org/plugins.`;

const SCHEMA_PREFIX = "Playground's blueprint schema rejects ";

/**
 * Builds the self-install step the blueprint must carry.
 *
 * @param overrides - Fields to replace on the step.
 * @return The step object.
 */
function installStep(
	overrides: Record< string, unknown > = {}
): Record< string, unknown > {
	return {
		step: 'installPlugin',
		pluginData: { resource: 'wordpress.org/plugins', slug: SLUG },
		options: { activate: true },
		...overrides,
	};
}

/**
 * Serializes a blueprint object the way a blueprint file stores it.
 *
 * @param blueprint - The blueprint object.
 * @return The JSON source.
 */
function source( blueprint: unknown ): string {
	return JSON.stringify( blueprint );
}

/**
 * Builds a blueprint source of an exact UTF-8 length by padding a valid
 * blueprint with trailing whitespace.
 *
 * @param bytes - The length the source must have.
 * @return The padded JSON source.
 */
function sourceOfLength( bytes: number ): string {
	const base = source( { steps: [ installStep() ] } );

	return base + ' '.repeat( bytes - base.length );
}

describe( 'findBlueprintErrors', () => {
	it( 'accepts a full blueprint shaped like the shipped one', () => {
		const blueprint = {
			$schema: 'https://playground.wordpress.net/blueprint-schema.json',
			landingPage: '/wp-admin/admin.php?page=bsbench-start-benchmark',
			preferredVersions: { php: '8.3', wp: 'latest' },
			features: { networking: true },
			login: true,
			steps: [ installStep() ],
		};

		expect( findBlueprintErrors( source( blueprint ), SLUG ) ).toEqual(
			[]
		);
	} );

	it( 'accepts a blueprint holding only the self-install step', () => {
		expect(
			findBlueprintErrors( source( { steps: [ installStep() ] } ), SLUG )
		).toEqual( [] );
	} );

	it( 'reports broken JSON', () => {
		const problems = findBlueprintErrors( '{ "steps": [', SLUG );

		expect( problems ).toHaveLength( 1 );
		expect( problems[ 0 ] ).toMatch( /^It is not valid JSON: / );
	} );

	it( 'rejects an array', () => {
		expect( findBlueprintErrors( '[]', SLUG ) ).toEqual( [
			OBJECT_MESSAGE,
		] );
	} );

	it( 'rejects null', () => {
		expect( findBlueprintErrors( 'null', SLUG ) ).toEqual( [
			OBJECT_MESSAGE,
		] );
	} );

	it( 'reports what the Playground schema rejects', () => {
		const problems = findBlueprintErrors(
			source( { steps: [ { step: 'notAStep' }, installStep() ] } ),
			SLUG
		);

		expect( problems.length ).toBeGreaterThan( 0 );

		for ( const problem of problems ) {
			expect( problem.startsWith( SCHEMA_PREFIX ) ).toBe( true );
		}
	} );

	it( 'requires steps', () => {
		expect(
			findBlueprintErrors( source( { landingPage: '/' } ), SLUG )
		).toEqual( [ INSTALL_MESSAGE ] );
	} );

	it( 'requires the self-install step to activate the plugin', () => {
		expect(
			findBlueprintErrors(
				source( { steps: [ installStep( { options: undefined } ) ] } ),
				SLUG
			)
		).toEqual( [ INSTALL_MESSAGE ] );
	} );

	it( 'rejects a self-install step that turns activation off', () => {
		expect(
			findBlueprintErrors(
				source( {
					steps: [ installStep( { options: { activate: false } } ) ],
				} ),
				SLUG
			)
		).toEqual( [ INSTALL_MESSAGE ] );
	} );

	it( 'rejects an install of another plugin', () => {
		expect(
			findBlueprintErrors(
				source( {
					steps: [
						installStep( {
							pluginData: {
								resource: 'wordpress.org/plugins',
								slug: 'query-monitor',
							},
						} ),
					],
				} ),
				SLUG
			)
		).toEqual( [ INSTALL_MESSAGE ] );
	} );

	it( 'rejects a blueprint one byte over the limit', () => {
		const kilobytes = ( ( BLUEPRINT_SIZE_LIMIT + 1 ) / 1024 ).toFixed( 1 );

		expect(
			findBlueprintErrors(
				sourceOfLength( BLUEPRINT_SIZE_LIMIT + 1 ),
				SLUG
			)
		).toEqual( [
			`It is ${ kilobytes } KB, over WordPress.org's 100 KB limit for a blueprint.`,
		] );
	} );

	it( 'allows a blueprint exactly at the limit', () => {
		expect(
			findBlueprintErrors( sourceOfLength( BLUEPRINT_SIZE_LIMIT ), SLUG )
		).toEqual( [] );
	} );
} );
