import { describe, it, expect } from 'vitest';
import { easeInOutQuad, lerp } from './Easing';

describe( 'easeInOutQuad', () => {
	it( 'pins the endpoints and the midpoint', () => {
		expect( easeInOutQuad( 0 ) ).toBe( 0 );
		expect( easeInOutQuad( 1 ) ).toBe( 1 );
		expect( easeInOutQuad( 0.5 ) ).toBeCloseTo( 0.5 );
	} );

	it( 'eases in (slower than linear early on)', () => {
		expect( easeInOutQuad( 0.25 ) ).toBeLessThan( 0.25 );
	} );
} );

describe( 'lerp', () => {
	it( 'interpolates linearly between endpoints', () => {
		expect( lerp( 0, 100, 0 ) ).toBe( 0 );
		expect( lerp( 0, 100, 1 ) ).toBe( 100 );
		expect( lerp( 20, 40, 0.5 ) ).toBe( 30 );
	} );
} );
