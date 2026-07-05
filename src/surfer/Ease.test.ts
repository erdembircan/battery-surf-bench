import { describe, it, expect } from 'vitest';
import { easeInOutQuad } from './Ease';

describe( 'easeInOutQuad', () => {
	it( 'starts at 0 and ends at 1', () => {
		expect( easeInOutQuad( 0 ) ).toBe( 0 );
		expect( easeInOutQuad( 1 ) ).toBe( 1 );
	} );

	it( 'passes through the midpoint unchanged', () => {
		expect( easeInOutQuad( 0.5 ) ).toBe( 0.5 );
	} );

	it( 'is monotonically increasing across the full range', () => {
		let previous = easeInOutQuad( 0 );
		for ( let i = 1; i <= 20; i++ ) {
			const t = i / 20;
			const value = easeInOutQuad( t );
			expect( value ).toBeGreaterThanOrEqual( previous );
			previous = value;
		}
	} );

	it( 'eases in slower than linear during the first quarter', () => {
		// Quad ease-in-out starts flatter than a straight line, so early
		// progress lags behind the linear value at the same t.
		expect( easeInOutQuad( 0.25 ) ).toBeLessThan( 0.25 );
	} );

	it( 'eases out slower than linear during the last quarter', () => {
		// ...and by symmetry, it overtakes linear again before easing back
		// down to meet it at t=1.
		expect( easeInOutQuad( 0.75 ) ).toBeGreaterThan( 0.75 );
	} );
} );
