import { describe, it, expect } from 'vitest';
import { Appetite } from '@/surfer/Appetite';

describe( 'Appetite', () => {
	it( 'starts full for an unseen key', () => {
		expect( new Appetite().valueFor( 'readPause' ) ).toBe( 1 );
	} );

	it( 'drops after consuming', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' );
		expect( appetite.valueFor( 'readPause' ) ).toBeCloseTo( 0.5, 5 );
	} );

	it( 'compounds across repeated consumption', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' );
		appetite.consume( 'readPause' );
		expect( appetite.valueFor( 'readPause' ) ).toBeCloseTo( 0.25, 5 );
	} );

	it( 'recovers one tick-equivalent step, capped at 1', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' ); // 0.5
		appetite.recover( 1 ); // 0.52
		expect( appetite.valueFor( 'readPause' ) ).toBeCloseTo( 0.52, 5 );

		for ( let i = 0; i < 100; i++ ) {
			appetite.recover( 1 );
		}
		expect( appetite.valueFor( 'readPause' ) ).toBe( 1 );
	} );

	it( 'recovers proportionally to the given steps', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' ); // 0.5
		appetite.recover( 5 ); // five tick-equivalents in one call

		expect( appetite.valueFor( 'readPause' ) ).toBeCloseTo( 0.6, 5 );
	} );

	it( 'never exceeds the ceiling even with a very large step count', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' );
		appetite.recover( 1000 );

		expect( appetite.valueFor( 'readPause' ) ).toBe( 1 );
	} );

	it( 'tracks each key independently', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' );
		expect( appetite.valueFor( 'watchVideo' ) ).toBe( 1 );
	} );
} );
