/**
 * Behavioral tests for the `/wp/v2/search` query builder and resolver.
 *
 * `apiFetch` is the boundary to WordPress' REST layer, so it is mocked here
 * the way any external dependency would be; what is asserted is the request
 * this module builds and how it turns the response into records + totals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { searchPath, useSearchResults } from './SearchQuery';

const hooks = vi.hoisted( () => ( {
	apiFetch: vi.fn(),
} ) );

vi.mock( '@wordpress/api-fetch', () => ( {
	default: hooks.apiFetch,
} ) );

/**
 * Builds a fetch-like `Response` double resolving to the given records and
 * pagination headers.
 *
 * @param records    The records the response's body resolves to.
 * @param totalItems The `X-WP-Total` header value.
 * @param totalPages The `X-WP-TotalPages` header value.
 * @return The response double.
 */
function fakeResponse(
	records: unknown[],
	totalItems: number,
	totalPages: number
) {
	return {
		json: () => Promise.resolve( records ),
		headers: new Headers( {
			'X-WP-Total': String( totalItems ),
			'X-WP-TotalPages': String( totalPages ),
		} ),
	} as Response;
}

beforeEach( () => {
	hooks.apiFetch.mockReset();
} );

describe( 'searchPath', () => {
	it( 'builds the search request with every query arg the Browse pane needs', () => {
		const path = searchPath( {
			search: 'about',
			subtype: 'page,post',
			page: 2,
			perPage: 10,
		} );

		expect( path ).toBe(
			'/wp/v2/search?type=post&subtype=page%2Cpost&search=about&page=2&per_page=10&_fields=id%2Ctitle%2Curl%2Csubtype'
		);
	} );

	it( 'narrows to a single subtype for the Pages/Posts tabs', () => {
		const path = searchPath( {
			search: '',
			subtype: 'page',
			page: 1,
			perPage: 10,
		} );

		expect( path ).toContain( 'subtype=page&' );
	} );
} );

describe( 'useSearchResults', () => {
	it( 'requests a single page with parse disabled, so headers are readable', async () => {
		hooks.apiFetch.mockResolvedValue( fakeResponse( [], 0, 1 ) );

		renderHook( () =>
			useSearchResults( {
				search: '',
				subtype: 'page,post',
				page: 1,
				perPage: 10,
			} )
		);

		await waitFor( () =>
			expect( hooks.apiFetch ).toHaveBeenCalledWith(
				expect.objectContaining( {
					path: expect.stringContaining( '/wp/v2/search?' ),
					parse: false,
				} )
			)
		);
	} );

	it( 'resolves the records and reads totals from the response headers', async () => {
		const records = [
			{ id: 1, title: 'About', url: '/about', subtype: 'page' },
		];
		hooks.apiFetch.mockResolvedValue( fakeResponse( records, 7, 2 ) );

		const { result } = renderHook( () =>
			useSearchResults( {
				search: '',
				subtype: 'page,post',
				page: 1,
				perPage: 10,
			} )
		);

		await waitFor( () =>
			expect( result.current.isResolving ).toBe( false )
		);

		expect( result.current.records ).toEqual( records );
		expect( result.current.totalItems ).toBe( 7 );
		expect( result.current.totalPages ).toBe( 2 );
	} );

	it( 'falls back to sane totals when a pagination header is non-numeric', async () => {
		const records = [
			{ id: 1, title: 'About', url: '/about', subtype: 'page' },
		];
		hooks.apiFetch.mockResolvedValue( {
			json: () => Promise.resolve( records ),
			headers: new Headers( {
				'X-WP-Total': 'not-a-number',
				'X-WP-TotalPages': 'nope',
			} ),
		} as Response );

		const { result } = renderHook( () =>
			useSearchResults( {
				search: '',
				subtype: 'page,post',
				page: 1,
				perPage: 10,
			} )
		);

		await waitFor( () =>
			expect( result.current.isResolving ).toBe( false )
		);

		// A mangled X-WP-Total falls back to the record count, X-WP-TotalPages to 1 —
		// never NaN, which would break the pager's `page >= totalPages` math.
		expect( result.current.totalItems ).toBe( records.length );
		expect( result.current.totalPages ).toBe( 1 );
	} );

	it( 'starts resolving, then reports isResolving false once settled', async () => {
		hooks.apiFetch.mockResolvedValue( fakeResponse( [], 0, 1 ) );

		const { result } = renderHook( () =>
			useSearchResults( {
				search: '',
				subtype: 'page,post',
				page: 1,
				perPage: 10,
			} )
		);

		expect( result.current.isResolving ).toBe( true );
		await waitFor( () =>
			expect( result.current.isResolving ).toBe( false )
		);
	} );

	it( 'recovers to an empty, settled result when the request fails', async () => {
		hooks.apiFetch.mockRejectedValue( new Error( 'network error' ) );

		const { result } = renderHook( () =>
			useSearchResults( {
				search: '',
				subtype: 'page,post',
				page: 1,
				perPage: 10,
			} )
		);

		await waitFor( () =>
			expect( result.current.isResolving ).toBe( false )
		);
		expect( result.current.records ).toEqual( [] );
		expect( result.current.totalItems ).toBe( 0 );
	} );

	it( 're-queries when the args change', async () => {
		hooks.apiFetch.mockResolvedValue( fakeResponse( [], 0, 1 ) );

		const { rerender } = renderHook(
			( props ) => useSearchResults( props ),
			{
				initialProps: {
					search: '',
					subtype: 'page,post',
					page: 1,
					perPage: 10,
				},
			}
		);

		await waitFor( () =>
			expect( hooks.apiFetch ).toHaveBeenCalledTimes( 1 )
		);

		rerender( { search: '', subtype: 'page,post', page: 2, perPage: 10 } );

		await waitFor( () =>
			expect( hooks.apiFetch ).toHaveBeenCalledTimes( 2 )
		);
		expect( hooks.apiFetch ).toHaveBeenLastCalledWith(
			expect.objectContaining( {
				path: expect.stringContaining( 'page=2' ),
			} )
		);
	} );
} );
