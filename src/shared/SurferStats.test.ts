import { describe, it, expect } from 'vitest';
import {
	STATS,
	STAT_COUNT,
	BUDGET,
	MIN,
	MAX,
	CLASSES,
	FRESH,
	pointsLeft,
	headroom,
	clampTrait,
	classify,
	normalizeTraits,
	type Archetype,
} from './SurferStats';

describe( 'SurferStats vector shape', () => {
	it( 'has five stats', () => {
		expect( STAT_COUNT ).toBe( 5 );
		expect( STATS ).toHaveLength( 5 );
	} );

	it( 'FRESH is a full blank slate with the whole budget unspent', () => {
		expect( FRESH() ).toEqual( [ MIN, MIN, MIN, MIN, MIN ] );
		expect( pointsLeft( FRESH() ) ).toBe( BUDGET );
	} );
} );

describe( 'presets', () => {
	it( 'every preset spends exactly the budget', () => {
		for ( const vec of Object.values( CLASSES ) ) {
			expect( vec ).toHaveLength( STAT_COUNT );
			expect( pointsLeft( vec ) ).toBe( 0 );
		}
	} );

	it( 'every stat in every preset is within range', () => {
		for ( const vec of Object.values( CLASSES ) ) {
			for ( const value of vec ) {
				expect( value ).toBeGreaterThanOrEqual( MIN );
				expect( value ).toBeLessThanOrEqual( MAX );
			}
		}
	} );

	it( 'every preset classifies back to its own name', () => {
		for ( const [ name, vec ] of Object.entries( CLASSES ) ) {
			expect( classify( vec ) ).toBe( name as Archetype );
		}
	} );
} );

describe( 'classify', () => {
	// [tempo, endurance, literacy, allure, fidget]
	it( 'reads high media + low reading as Binge-Watcher', () => {
		expect( classify( [ 3, 7, 2, 10, 3 ] ) ).toBe( 'Binge-Watcher' );
	} );

	it( 'returns Custom when no rule matches', () => {
		expect( classify( [ 0, 0, 0, 0, 0 ] ) ).toBe( 'Custom' );
	} );

	it( 'prefers Jitterbug over Skimmer when fidget is high', () => {
		// tempo>=6 && endurance<=4 would be Skimmer, but fidget>=8 wins first.
		expect( classify( [ 6, 4, 2, 3, 10 ] ) ).toBe( 'Jitterbug' );
	} );

	it( 'reads all-mid as Balanced', () => {
		expect( classify( [ 4, 5, 6, 5, 4 ] ) ).toBe( 'Balanced' );
	} );

	it( 'a value outside the mid band is not Balanced', () => {
		expect( classify( [ 4, 5, 6, 5, 7 ] ) ).not.toBe( 'Balanced' );
	} );
} );

describe( 'point-buy clamping', () => {
	it( 'caps a raise at the remaining budget', () => {
		// Spent 23, 2 left; stat 0 currently 5 → can reach at most 7.
		const vec = [ 5, 5, 6, 5, 2 ];
		expect( pointsLeft( vec ) ).toBe( 2 );
		expect( clampTrait( vec, 0, 10 ) ).toBe( 7 );
	} );

	it( 'never lets a raise exceed the budget', () => {
		const vec = [ 5, 5, 5, 5, 5 ];
		for ( let i = 0; i < STAT_COUNT; i++ ) {
			const next = [ ...vec ];
			next[ i ] = clampTrait( vec, i, MAX );
			expect( pointsLeft( next ) ).toBeGreaterThanOrEqual( 0 );
		}
	} );

	it( 'clamps below MIN and above MAX', () => {
		expect( clampTrait( FRESH(), 0, -5 ) ).toBe( MIN );
		expect( clampTrait( FRESH(), 0, 999 ) ).toBe( MAX );
	} );

	it( 'headroom is the value plus what is affordable, capped at MAX', () => {
		const vec = [ 5, 5, 6, 5, 2 ]; // 2 points left
		expect( headroom( vec, 0 ) ).toBe( 7 ); // 5 + 2
		const full = [ 9, 5, 5, 5, 1 ]; // 0 left
		expect( headroom( full, 0 ) ).toBe( 9 ); // value + 0
	} );
} );

describe( 'normalizeTraits', () => {
	it( 'falls back to Balanced for a non-array', () => {
		expect( normalizeTraits( 'nope' ) ).toEqual( CLASSES.Balanced );
		expect( normalizeTraits( null ) ).toEqual( CLASSES.Balanced );
	} );

	it( 'coerces length to STAT_COUNT, padding missing stats', () => {
		expect( normalizeTraits( [ 5, 5 ] ) ).toHaveLength( STAT_COUNT );
	} );

	it( 'clamps each stat into range and trims overspend to the budget', () => {
		const out = normalizeTraits( [ 99, 99, 99, 99, 99 ] );
		expect( pointsLeft( out ) ).toBeGreaterThanOrEqual( 0 );
		for ( const value of out ) {
			expect( value ).toBeGreaterThanOrEqual( MIN );
			expect( value ).toBeLessThanOrEqual( MAX );
		}
	} );

	it( 'leaves a valid vector unchanged', () => {
		expect( normalizeTraits( CLASSES.Scholar ) ).toEqual( CLASSES.Scholar );
	} );

	it( 'rounds fractional values', () => {
		expect( normalizeTraits( [ 5.4, 0, 0, 0, 0 ] )[ 0 ] ).toBe( 5 );
	} );
} );
