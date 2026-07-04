import { describe, it, expect } from 'vitest';
import { Appetite } from './Appetite';

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

	it( 'recovers a step per tick, capped at 1', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' ); // 0.5
		appetite.recoverTick(); // 0.52
		expect( appetite.valueFor( 'readPause' ) ).toBeCloseTo( 0.52, 5 );

		for ( let i = 0; i < 100; i++ ) {
			appetite.recoverTick();
		}
		expect( appetite.valueFor( 'readPause' ) ).toBe( 1 );
	} );

	it( 'tracks each key independently', () => {
		const appetite = new Appetite();
		appetite.consume( 'readPause' );
		expect( appetite.valueFor( 'watchVideo' ) ).toBe( 1 );
	} );
} );
