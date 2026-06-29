import { describe, it, expect } from 'vitest';
import { behaviorFor } from './Behavior';

const BALANCED = [ 5, 5, 5, 5, 5, 5 ];

describe( 'behaviorFor — speed (VHS fast-forward)', () => {
	it( 'divides only the time knobs, leaving the rest untouched', () => {
		const base = behaviorFor( BALANCED, 'article', 1 );
		const fast = behaviorFor( BALANCED, 'article', 2 );

		// Time knobs halve at 2×.
		expect( fast.dwellMs ).toBeCloseTo( base.dwellMs / 2 );
		expect( fast.burstGapMs ).toBeCloseTo( base.burstGapMs / 2 );
		expect( fast.readingPauseMs ).toBeCloseTo( base.readingPauseMs / 2 );

		// Untimed knobs are identical.
		expect( fast.scrollDepth ).toBe( base.scrollDepth );
		expect( fast.burstPx ).toBe( base.burstPx );
		expect( fast.readingPauseChance ).toBe( base.readingPauseChance );
		expect( fast.scrollUpChance ).toBe( base.scrollUpChance );
	} );

	it( 'treats a zero/negative speed as 1×', () => {
		const base = behaviorFor( BALANCED, 'article', 1 );
		expect( behaviorFor( BALANCED, 'article', 0 ).dwellMs ).toBe(
			base.dwellMs
		);
	} );
} );

describe( 'behaviorFor — stats reflect on the page', () => {
	const stat = ( index: number, value: number ): number[] => {
		const vec = [ 0, 0, 0, 0, 0, 0 ];
		vec[ index ] = value;
		return vec;
	};

	it( 'Reach (idx 2) drives scroll depth', () => {
		expect(
			behaviorFor( stat( 2, 10 ), 'article' ).scrollDepth
		).toBeGreaterThan( behaviorFor( stat( 2, 0 ), 'article' ).scrollDepth );
	} );

	it( 'Haste (idx 0) speeds bursts: bigger px, shorter gaps', () => {
		const fast = behaviorFor( stat( 0, 10 ), 'article' );
		const slow = behaviorFor( stat( 0, 0 ), 'article' );
		expect( fast.burstPx ).toBeGreaterThan( slow.burstPx );
		expect( fast.burstGapMs ).toBeLessThan( slow.burstGapMs );
	} );

	it( 'Literacy (idx 3) drives reading pauses, more on articles than link pages', () => {
		const article = behaviorFor( stat( 3, 10 ), 'article' );
		const links = behaviorFor( stat( 3, 10 ), 'links' );
		expect( article.readingPauseChance ).toBeGreaterThan( 0 );
		expect( article.readingPauseChance ).toBeGreaterThan(
			links.readingPauseChance
		);
	} );

	it( 'Recall (idx 4) drives re-read scroll-ups', () => {
		expect(
			behaviorFor( stat( 4, 10 ), 'article' ).scrollUpChance
		).toBeGreaterThan(
			behaviorFor( stat( 4, 0 ), 'article' ).scrollUpChance
		);
	} );

	it( 'Allure (idx 5) drives video only on the video page', () => {
		const onVideo = behaviorFor( stat( 5, 10 ), 'video' );
		const onArticle = behaviorFor( stat( 5, 10 ), 'article' );
		expect( onVideo.videoWatchFraction ).toBeGreaterThan( 0 );
		expect( onVideo.videoReplayChance ).toBeGreaterThan( 0 );
		expect( onArticle.videoWatchFraction ).toBe( 0 );
		expect( onArticle.videoReplayChance ).toBe( 0 );
	} );

	it( 'keeps scroll depth within 0–1', () => {
		expect(
			behaviorFor( [ 10, 10, 10, 10, 10, 10 ], 'article' ).scrollDepth
		).toBeLessThanOrEqual( 1 );
	} );
} );
