/**
 * Tests for the Konami-code recognizer behind the cockpit's shark-fin Easter
 * egg. Pure over a progress counter, a key and an elapsed-time gap — no DOM,
 * no Interactivity runtime.
 */

import { describe, it, expect } from 'vitest';
import {
	KONAMI_SEQUENCE,
	KONAMI_TIMEOUT_MS,
	nextKonamiProgress,
	isKonamiComplete,
} from '@/cockpit/KonamiCode';

/**
 * Feeds a full sequence through the recognizer with comfortable gaps.
 *
 * @param keys The keys to press in order.
 */
const runSequence = ( keys: string[] ): number =>
	keys.reduce(
		( progress, key ) => nextKonamiProgress( progress, key, 0 ),
		0
	);

describe( 'KONAMI_TIMEOUT_MS', () => {
	it( 'is 300ms', () => {
		expect( KONAMI_TIMEOUT_MS ).toBe( 300 );
	} );
} );

describe( 'nextKonamiProgress', () => {
	it( 'completes the full sequence with a comfortable gap between every key', () => {
		const progress = runSequence( [ ...KONAMI_SEQUENCE ] );

		expect( isKonamiComplete( progress ) ).toBe( true );
	} );

	it( 'is case-insensitive', () => {
		const progress = runSequence( [
			'ArrowUp',
			'ArrowUp',
			'ArrowDown',
			'ArrowDown',
			'ArrowLeft',
			'ArrowRight',
			'ArrowLeft',
			'ArrowRight',
			'B',
			'A',
		] );

		expect( isKonamiComplete( progress ) ).toBe( true );
	} );

	it( 'resets to 0 on a mismatch that is not the first key', () => {
		expect( nextKonamiProgress( 3, 'x', 0 ) ).toBe( 0 );
	} );

	it( 'resets all the way to 0 even when the mismatched key equals the sequence’s first element — strictly all-or-nothing, no credit', () => {
		expect( nextKonamiProgress( 3, 'ArrowUp', 0 ) ).toBe( 0 );
	} );

	it( 'the key right after a mismatch-reset can still begin a fresh sequence, evaluated fresh at progress 0', () => {
		const afterMismatch = nextKonamiProgress( 3, 'x', 0 );
		expect( afterMismatch ).toBe( 0 );

		expect( nextKonamiProgress( afterMismatch, 'ArrowUp', 0 ) ).toBe( 1 );
	} );

	it( 'has nothing left to match once past the sequence length, so any key resets it — including the sequence’s own first element', () => {
		expect( nextKonamiProgress( KONAMI_SEQUENCE.length, 'x', 0 ) ).toBe(
			0
		);
		expect(
			nextKonamiProgress( KONAMI_SEQUENCE.length, 'arrowup', 0 )
		).toBe( 0 );
	} );

	describe( 'the inter-key timeout', () => {
		it( 'preserves progress when the gap is within the timeout', () => {
			expect( nextKonamiProgress( 2, 'arrowdown', 299 ) ).toBe( 3 );
			expect( nextKonamiProgress( 2, 'arrowdown', 300 ) ).toBe( 3 );
		} );

		it( 'starts the sequence over when the gap exceeds the timeout, matching the first key', () => {
			// Progress 2 expects 'arrowdown' next; a stale gap resets first, so
			// 'arrowup' — the sequence's own first element — begins fresh.
			expect( nextKonamiProgress( 2, 'arrowup', 301 ) ).toBe( 1 );
		} );

		it( 'starts the sequence over when the gap exceeds the timeout, with a non-first key', () => {
			expect( nextKonamiProgress( 2, 'x', 301 ) ).toBe( 0 );
		} );

		it( 'a stale gap does not fail the match outright — the key can still begin a fresh sequence', () => {
			// Deep into the sequence, then a long pause, then 'arrowup' again:
			// yields the same progress (1) a first-ever 'arrowup' would.
			const afterPause = nextKonamiProgress( 7, 'arrowup', 5000 );
			expect( afterPause ).toBe( nextKonamiProgress( 0, 'arrowup', 0 ) );
			expect( afterPause ).toBe( 1 );
		} );
	} );
} );

describe( 'isKonamiComplete', () => {
	it( 'is false before the sequence length is reached', () => {
		expect( isKonamiComplete( KONAMI_SEQUENCE.length - 1 ) ).toBe( false );
	} );

	it( 'is true at exactly the sequence length', () => {
		expect( isKonamiComplete( KONAMI_SEQUENCE.length ) ).toBe( true );
	} );

	it( 'stays true past the sequence length', () => {
		expect( isKonamiComplete( KONAMI_SEQUENCE.length + 1 ) ).toBe( true );
	} );
} );
