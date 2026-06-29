import { describe, it, expect } from 'vitest';
import { parseRunParams } from './RunParams';
import { CLASSES } from '../shared/SurferStats';

describe( 'parseRunParams', () => {
	it( 'is unarmed without the run flag', () => {
		expect( parseRunParams( '' ).armed ).toBe( false );
		expect( parseRunParams( '?bsbSessionPage=article-1' ).armed ).toBe(
			false
		);
	} );

	it( 'arms on bsbRun=1', () => {
		expect( parseRunParams( '?bsbRun=1' ).armed ).toBe( true );
	} );

	it( 'normalizes the speed, falling back to 1× for unsupported values', () => {
		expect( parseRunParams( '?bsbSpeed=4' ).speed ).toBe( 4 );
		expect( parseRunParams( '?bsbSpeed=7' ).speed ).toBe( 1 );
		expect( parseRunParams( '?bsbSpeed=' ).speed ).toBe( 1 );
	} );

	it( 'parses and normalizes the traits csv', () => {
		expect( parseRunParams( '?bsbTraits=1,2,3,4,5,6' ).traits ).toEqual( [
			1, 2, 3, 4, 5, 6,
		] );
	} );

	it( 'falls back to Balanced traits when absent', () => {
		expect( parseRunParams( '?bsbRun=1' ).traits ).toEqual(
			CLASSES.Balanced
		);
	} );

	it( 'clamps a tampered traits csv to the budget', () => {
		const { traits } = parseRunParams( '?bsbTraits=10,10,10,10,10,10' );
		expect( traits.reduce( ( a, b ) => a + b, 0 ) ).toBeLessThanOrEqual(
			30
		);
	} );

	it( 'reads the course slug', () => {
		expect(
			parseRunParams( '?bsbSessionPage=gallery&bsbRun=1' ).slug
		).toBe( 'gallery' );
	} );
} );
