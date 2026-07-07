/**
 * Behavioral tests for the Browse pane's query args and pager.
 *
 * `useSearchResults` is `BrowsePane`'s data source, so — following the
 * pattern `src/sessions/App.test.tsx` uses for DataViews — the query args it
 * is called with, and what it reports back (totals, resolving), are the
 * observable contract asserted here. The hook's own request-building and
 * header-parsing behavior is covered by `SearchQuery.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hooks = vi.hoisted( () => ( {
	useSearchResults: vi.fn(),
} ) );

vi.mock( './SearchQuery', () => ( {
	useSearchResults: hooks.useSearchResults,
} ) );

const { BrowsePane } = await import( './BrowsePane' );

/**
 * A representative resolved query result.
 *
 * @param records     The search results to resolve.
 * @param totalItems  The collection total the query reports.
 * @param totalPages  The page count the query reports.
 * @param isResolving Whether the query reports a fetch in flight.
 */
function result(
	records: Array< { id: number; title: string; subtype: string } >,
	totalItems: number,
	totalPages: number,
	isResolving = false
) {
	return {
		records: records.map( ( item ) => ( {
			id: item.id,
			title: item.title,
			url: `https://example.test/${ item.id }`,
			subtype: item.subtype,
		} ) ),
		totalItems,
		totalPages,
		isResolving,
	};
}

beforeEach( () => {
	hooks.useSearchResults.mockReset();
} );

describe( 'BrowsePane queries', () => {
	it( 'queries both selectable subtypes as one request on first render (the "All" filter)', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		expect( hooks.useSearchResults ).toHaveBeenCalledWith( {
			search: '',
			subtype: 'page,post',
			page: 1,
			perPage: 10,
		} );
	} );

	it( 'narrows to a single subtype when the Pages filter is active', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'page' } )
		);
	} );

	it( 'narrows to the post subtype when the Posts filter is active', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Posts' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'post' } )
		);
	} );

	it( 'renders every returned record, spanning both subtypes', () => {
		hooks.useSearchResults.mockReturnValue(
			result(
				[
					{ id: 1, title: 'About', subtype: 'page' },
					{ id: 2, title: 'Field Notes', subtype: 'post' },
				],
				2,
				1
			)
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByText( 'About' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Field Notes' ) ).toBeInTheDocument();
	} );

	it( 'reports the single query total, matching the rows shown', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 10, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByText( /10 items/ ) ).toBeInTheDocument();
	} );

	it( 'shows an already-selected row as Added rather than offering to add it again', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set( [ 1 ] ) }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByText( 'Added' ) ).toBeInTheDocument();
		expect( screen.queryByText( 'Add' ) ).not.toBeInTheDocument();
	} );

	it( 'calls onAdd with the record id, subtype and title', () => {
		const onAdd = vi.fn();
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 5, title: 'Pricing', subtype: 'page' } ], 1, 1 )
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ onAdd }
			/>
		);

		fireEvent.click( screen.getByText( 'Add' ) );

		expect( onAdd ).toHaveBeenCalledWith( 5, 'page', 'Pricing' );
	} );

	it( 're-queries from page 1 when the type filter changes', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Next ›' ) );
		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'page', page: 1 } )
		);
	} );
} );

describe( 'BrowsePane pager', () => {
	it( 'disables Prev on the first page and enables Next when more pages exist', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByText( '‹ Prev' ) ).toBeDisabled();
		expect( screen.getByText( 'Next ›' ) ).not.toBeDisabled();
		expect( screen.getByText( 'Page 1 of 3' ) ).toBeInTheDocument();
	} );

	it( 'advances to the next page and re-queries with the new page number', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Next ›' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { page: 2 } )
		);
	} );
} );
