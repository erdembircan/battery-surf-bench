import { describe, it, expect } from 'vitest';
import { pickBehavior } from '@/surfer/Arbiter';
import { mulberry32 } from '@/surfer/Rng';
import type { Behavior } from '@/surfer/Behavior';

/**
 * A minimal stub behavior — only `key` matters for arbiter tests.
 * @param key
 */
const stub = ( key: string ): Behavior => ( {
	key,
	bid: () => 0,
	run: () => Promise.resolve(),
} );

describe( 'pickBehavior', () => {
	it( 'returns null for an empty list', () => {
		expect( pickBehavior( [], mulberry32( 1 ) ) ).toBeNull();
	} );

	it( 'returns null when every bid is zero or negative', () => {
		const bids = [
			{ b: stub( 'a' ), bid: 0 },
			{ b: stub( 'b' ), bid: -1 },
		];
		expect( pickBehavior( bids, mulberry32( 1 ) ) ).toBeNull();
	} );

	it( 'always picks the only positive bid', () => {
		const zero = stub( 'zero' );
		const one = stub( 'one' );
		const bids = [
			{ b: zero, bid: 0 },
			{ b: one, bid: 5 },
		];
		const rng = mulberry32( 7 );

		for ( let i = 0; i < 100; i++ ) {
			expect( pickBehavior( bids, rng ) ).toBe( one );
		}
	} );

	it( 'draws proportional to bid weight over many draws', () => {
		const behaviorA = stub( 'a' );
		const behaviorB = stub( 'b' );
		const behaviorC = stub( 'c' );
		const bids = [
			{ b: behaviorA, bid: 1 },
			{ b: behaviorB, bid: 3 },
			{ b: behaviorC, bid: 0 },
		];
		const rng = mulberry32( 42 );
		const counts = { a: 0, b: 0, c: 0 };
		const draws = 10000;

		for ( let i = 0; i < draws; i++ ) {
			const winner = pickBehavior( bids, rng );
			if ( winner ) {
				counts[ winner.key as 'a' | 'b' | 'c' ]++;
			}
		}

		expect( counts.c ).toBe( 0 ); // zero-bid never picked
		expect( counts.a / draws ).toBeCloseTo( 0.25, 1 );
		expect( counts.b / draws ).toBeCloseTo( 0.75, 1 );
	} );
} );
