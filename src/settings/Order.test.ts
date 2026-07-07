/**
 * Behavioral tests for the pure surf-course order operations.
 *
 * These are the operations every mutation in the settings app funnels
 * through — add, remove, reorder, dedupe and heal — so they are tested here
 * as plain data transforms, independent of any component.
 */

import { describe, it, expect } from 'vitest';
import {
	addUserPage,
	dedupe,
	entryKey,
	hasUserPage,
	healBundled,
	removeUserPage,
	reorderByKey,
} from './Order';
import type { OrderEntry } from './Types';

const bundledA: OrderEntry = { kind: 'bundled', slug: 'article-1' };
const bundledB: OrderEntry = { kind: 'bundled', slug: 'gallery' };
const userA: OrderEntry = { kind: 'user', id: 12 };
const userB: OrderEntry = { kind: 'user', id: 34 };

describe( 'entryKey', () => {
	it( 'builds a stable key for a bundled entry from its slug', () => {
		expect( entryKey( bundledA ) ).toBe( 'bundled:article-1' );
	} );

	it( 'builds a stable key for a user entry from its id', () => {
		expect( entryKey( userA ) ).toBe( 'user:12' );
	} );
} );

describe( 'hasUserPage', () => {
	it( 'finds a user id already in the order', () => {
		expect( hasUserPage( [ bundledA, userA ], 12 ) ).toBe( true );
	} );

	it( 'does not match a bundled entry against a user id', () => {
		expect( hasUserPage( [ bundledA ], 12 ) ).toBe( false );
	} );
} );

describe( 'addUserPage', () => {
	it( 'appends a new user page to the end of the order', () => {
		expect( addUserPage( [ bundledA ], 12 ) ).toEqual( [
			bundledA,
			userA,
		] );
	} );

	it( 'is a no-op when the page is already in the order', () => {
		const order = [ bundledA, userA ];
		expect( addUserPage( order, 12 ) ).toBe( order );
	} );
} );

describe( 'removeUserPage', () => {
	it( 'removes the matching user entry', () => {
		expect( removeUserPage( [ bundledA, userA, userB ], 12 ) ).toEqual( [
			bundledA,
			userB,
		] );
	} );

	it( 'never removes a bundled entry, even one that shares no id concept', () => {
		expect( removeUserPage( [ bundledA ], 12 ) ).toEqual( [ bundledA ] );
	} );

	it( 'is a no-op when the id is not present', () => {
		expect( removeUserPage( [ bundledA, userA ], 999 ) ).toEqual( [
			bundledA,
			userA,
		] );
	} );
} );

describe( 'reorderByKey', () => {
	it( 'moves an entry to the position of another', () => {
		const order = [ bundledA, bundledB, userA, userB ];
		expect(
			reorderByKey( order, entryKey( userB ), entryKey( bundledA ) )
		).toEqual( [ userB, bundledA, bundledB, userA ] );
	} );

	it( 'moves an entry later in the list', () => {
		const order = [ bundledA, bundledB, userA ];
		expect(
			reorderByKey( order, entryKey( bundledA ), entryKey( userA ) )
		).toEqual( [ bundledB, userA, bundledA ] );
	} );

	it( 'is a no-op when the two keys are the same', () => {
		const order = [ bundledA, userA ];
		expect(
			reorderByKey( order, entryKey( userA ), entryKey( userA ) )
		).toBe( order );
	} );

	it( 'is a no-op when a key cannot be found', () => {
		const order = [ bundledA, userA ];
		expect( reorderByKey( order, 'user:999', entryKey( userA ) ) ).toBe(
			order
		);
	} );
} );

describe( 'dedupe', () => {
	it( 'keeps only the first occurrence of a repeated bundled slug', () => {
		expect( dedupe( [ bundledA, bundledA, bundledB ] ) ).toEqual( [
			bundledA,
			bundledB,
		] );
	} );

	it( 'keeps only the first occurrence of a repeated user id', () => {
		expect( dedupe( [ userA, userB, userA ] ) ).toEqual( [ userA, userB ] );
	} );

	it( 'leaves an order with no duplicates unchanged', () => {
		expect( dedupe( [ bundledA, userA ] ) ).toEqual( [ bundledA, userA ] );
	} );
} );

describe( 'healBundled', () => {
	const catalog = [
		{ slug: 'article-1', title: 'A' },
		{ slug: 'gallery', title: 'B' },
		{ slug: 'article-2', title: 'C' },
	];

	it( 'appends bundled catalog pages missing from the order', () => {
		expect( healBundled( [ bundledA ], catalog ) ).toEqual( [
			bundledA,
			{ kind: 'bundled', slug: 'gallery' },
			{ kind: 'bundled', slug: 'article-2' },
		] );
	} );

	it( 'returns the same order (no new array) when nothing is missing', () => {
		const order = [
			bundledA,
			bundledB,
			{ kind: 'bundled', slug: 'article-2' } as OrderEntry,
		];
		expect( healBundled( order, catalog ) ).toBe( order );
	} );

	it( 'leaves user entries untouched while healing', () => {
		expect( healBundled( [ userA ], catalog ) ).toEqual( [
			userA,
			{ kind: 'bundled', slug: 'article-1' },
			{ kind: 'bundled', slug: 'gallery' },
			{ kind: 'bundled', slug: 'article-2' },
		] );
	} );
} );
