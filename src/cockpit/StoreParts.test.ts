/**
 * Tests for the cockpit store composition.
 *
 * The consumer is the store registration: it relies on `mergeStoreParts` to fold
 * the domain slices into one definition while keeping reactive getters live (the
 * Interactivity runtime needs getters, not the values they would yield at merge
 * time) and merging actions and callbacks by reference.
 */

import { describe, it, expect } from 'vitest';
import { mergeStoreParts } from '@/cockpit/StoreParts';

describe( 'mergeStoreParts', () => {
	it( 'merges state, actions and callbacks from every slice', () => {
		const merged = mergeStoreParts(
			{ state: { a: 1 }, actions: { doA() {} } },
			{ state: { b: 2 }, callbacks: { onB() {} } }
		);

		expect( merged.state ).toMatchObject( { a: 1, b: 2 } );
		expect( merged.actions ).toHaveProperty( 'doA' );
		expect( merged.callbacks ).toHaveProperty( 'onB' );
	} );

	it( 'preserves state getters as getters rather than invoking them', () => {
		let reads = 0;
		const slice = {
			state: {
				get live(): number {
					reads += 1;
					return reads;
				},
			},
		};

		const merged = mergeStoreParts( slice );

		// Not read during the merge itself.
		expect( reads ).toBe( 0 );

		const descriptor = Object.getOwnPropertyDescriptor(
			merged.state,
			'live'
		);
		expect( typeof descriptor?.get ).toBe( 'function' );

		// Re-reading evaluates the getter each time (still live, not frozen).
		const state = merged.state as { live: number };
		expect( state.live ).toBe( 1 );
		expect( state.live ).toBe( 2 );
	} );

	it( 'lets a later slice override an earlier action of the same name', () => {
		const first = { actions: { run: () => 'first' } };
		const second = { actions: { run: () => 'second' } };

		const merged = mergeStoreParts( first, second ) as {
			actions: { run: () => string };
		};

		expect( merged.actions.run() ).toBe( 'second' );
	} );

	it( 'returns empty sections when no slice contributes them', () => {
		const merged = mergeStoreParts( { state: { a: 1 } } );

		expect( merged.actions ).toEqual( {} );
		expect( merged.callbacks ).toEqual( {} );
	} );
} );
