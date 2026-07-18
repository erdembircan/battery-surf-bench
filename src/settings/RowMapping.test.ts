/**
 * Behavioral tests for mapping the surf-course order into Selected-pane rows.
 */

import { describe, it, expect } from 'vitest';
import { mapOrderToRows } from '@/settings/RowMapping';
import type { BundledCatalogEntry, OrderEntry } from '@/settings/Types';

const catalog: BundledCatalogEntry[] = [
	{ slug: 'article-1', title: 'The Hidden Cost of a Browser Tab' },
	{ slug: 'gallery', title: 'Inside the Machine' },
];

describe( 'mapOrderToRows', () => {
	it( 'resolves a bundled entry to its catalog title, badged as built-in', () => {
		const order: OrderEntry[] = [ { kind: 'bundled', slug: 'article-1' } ];

		const rows = mapOrderToRows( order, catalog, {} );

		expect( rows ).toEqual( [
			{
				key: 'bundled:article-1',
				title: 'The Hidden Cost of a Browser Tab',
				badge: 'bundled',
				entry: order[ 0 ],
			},
		] );
	} );

	it( 'falls back to the slug when a bundled slug is not (yet) in the catalog', () => {
		const order: OrderEntry[] = [ { kind: 'bundled', slug: 'mystery' } ];

		const rows = mapOrderToRows( order, catalog, {} );

		expect( rows[ 0 ].title ).toBe( 'mystery' );
	} );

	it( 'resolves a user entry from the fetched post info, badging it by type', () => {
		const order: OrderEntry[] = [ { kind: 'user', id: 42 } ];

		const rows = mapOrderToRows( order, catalog, {
			42: { title: 'About', type: 'page' },
		} );

		expect( rows ).toEqual( [
			{
				key: 'user:42',
				title: 'About',
				badge: 'page',
				entry: order[ 0 ],
			},
		] );
	} );

	it( 'badges a resolved post-type user entry as a post', () => {
		const order: OrderEntry[] = [ { kind: 'user', id: 7 } ];

		const rows = mapOrderToRows( order, catalog, {
			7: { title: 'Field Notes', type: 'post' },
		} );

		expect( rows[ 0 ].badge ).toBe( 'post' );
	} );

	it( 'falls back to a neutral placeholder, never the raw id, while a user page has not resolved yet', () => {
		const order: OrderEntry[] = [ { kind: 'user', id: 99 } ];

		const rows = mapOrderToRows( order, catalog, {} );

		expect( rows[ 0 ] ).toEqual( {
			key: 'user:99',
			title: '—',
			badge: 'page',
			entry: order[ 0 ],
		} );
	} );

	it( 'maps a mixed order, preserving its visit order', () => {
		const order: OrderEntry[] = [
			{ kind: 'bundled', slug: 'article-1' },
			{ kind: 'user', id: 1 },
			{ kind: 'bundled', slug: 'gallery' },
		];

		const rows = mapOrderToRows( order, catalog, {
			1: { title: 'Contact', type: 'page' },
		} );

		expect( rows.map( ( row ) => row.key ) ).toEqual( [
			'bundled:article-1',
			'user:1',
			'bundled:gallery',
		] );
	} );

	it( 'returns no rows for an empty order', () => {
		expect( mapOrderToRows( [], catalog, {} ) ).toEqual( [] );
	} );
} );
