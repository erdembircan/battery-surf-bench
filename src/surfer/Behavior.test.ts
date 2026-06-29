import { describe, it, expect } from 'vitest';
import { behaviorFor } from './Behavior';

const BALANCED = [ 5, 5, 5, 5, 5, 5 ];

const stat = ( index: number, value: number ): number[] => {
	const vec = [ 0, 0, 0, 0, 0, 0 ];
	vec[ index ] = value;
	return vec;
};

describe( 'behaviorFor — speed (VHS fast-forward)', () => {
	it( 'divides only the time magnitudes, leaving sizes/depth untouched', () => {
		const base = behaviorFor( BALANCED, 'article', 1 );
		const fast = behaviorFor( BALANCED, 'article', 2 );

		expect( fast.dwellMs ).toBeCloseTo( base.dwellMs / 2 );
		expect( fast.burstGapMs ).toBeCloseTo( base.burstGapMs / 2 );
		expect( fast.readingPauseMs ).toBeCloseTo( base.readingPauseMs / 2 );

		expect( fast.scrollDepth ).toBe( base.scrollDepth );
		expect( fast.burstPx ).toBe( base.burstPx );
	} );

	it( 'treats a zero/negative speed as 1×', () => {
		expect( behaviorFor( BALANCED, 'article', 0 ).dwellMs ).toBe(
			behaviorFor( BALANCED, 'article', 1 ).dwellMs
		);
	} );
} );

describe( 'behaviorFor — stats size their action', () => {
	it( 'Reach (idx 2) drives scroll depth, clamped to 0–1', () => {
		expect(
			behaviorFor( stat( 2, 10 ), 'article' ).scrollDepth
		).toBeGreaterThan( behaviorFor( stat( 2, 0 ), 'article' ).scrollDepth );
		expect(
			behaviorFor( [ 10, 10, 10, 10, 10, 10 ], 'article' ).scrollDepth
		).toBeLessThanOrEqual( 1 );
	} );

	it( 'Haste (idx 0) makes bigger bursts and shorter gaps', () => {
		const fast = behaviorFor( stat( 0, 10 ), 'article' );
		const slow = behaviorFor( stat( 0, 0 ), 'article' );
		expect( fast.burstPx ).toBeGreaterThan( slow.burstPx );
		expect( fast.burstGapMs ).toBeLessThan( slow.burstGapMs );
	} );

	it( 'Literacy (idx 3) lengthens the reading pause and the article dwell', () => {
		const lit = behaviorFor( stat( 3, 10 ), 'article' );
		const noLit = behaviorFor( stat( 3, 0 ), 'article' );
		expect( lit.readingPauseMs ).toBeGreaterThan( noLit.readingPauseMs );
		expect( lit.dwellMs ).toBeGreaterThan( noLit.dwellMs );
	} );

	it( 'Endurance (idx 1) lengthens the dwell', () => {
		expect( behaviorFor( stat( 1, 10 ), 'links' ).dwellMs ).toBeGreaterThan(
			behaviorFor( stat( 1, 0 ), 'links' ).dwellMs
		);
	} );
} );
