/**
 * Behavioral tests for the pure surf-course order operations.
 *
 * These are the operations every mutation in the settings app funnels
 * through — add, remove and reorder — so they are tested here as plain data
 * transforms, independent of any component.
 */

import { describe, it, expect } from 'vitest';
import {
	addBundledPage,
	addUserPage,
	entryKey,
	hasUserPage,
	removeEntry,
	reorderByKey,
} from '@/settings/Order';
import type { OrderEntry } from '@/settings/Types';

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

describe( 'addBundledPage', () => {
	it( 'appends a bundled catalog page to the end of the order', () => {
		expect( addBundledPage( [ userA ], 'article-1' ) ).toEqual( [
			userA,
			bundledA,
		] );
	} );

	it( 'is a no-op when the page is already in the order', () => {
		const order = [ bundledA, userA ];
		expect( addBundledPage( order, 'article-1' ) ).toBe( order );
	} );
} );

describe( 'removeEntry', () => {
	it( 'removes a matching user entry', () => {
		expect( removeEntry( [ bundledA, userA, userB ], userA ) ).toEqual( [
			bundledA,
			userB,
		] );
	} );

	it( 'removes a matching bundled entry — every row is removable now', () => {
		expect(
			removeEntry( [ bundledA, bundledB, userA ], bundledA )
		).toEqual( [ bundledB, userA ] );
	} );

	it( 'is a no-op when the entry is not present', () => {
		expect( removeEntry( [ bundledA, userA ], userB ) ).toEqual( [
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
