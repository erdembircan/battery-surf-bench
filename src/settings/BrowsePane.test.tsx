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
 * @param isError     Whether the query reports its most recent request failed.
 */
function result(
	records: Array< { id: number; title: string; subtype: string } >,
	totalItems: number,
	totalPages: number,
	isResolving = false,
	isError = false
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
		isError,
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
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect( hooks.useSearchResults ).toHaveBeenCalledWith(
			{
				search: '',
				subtype: 'page,post',
				page: 1,
				perPage: 10,
			},
			undefined
		);
	} );

	it( 'narrows to a single subtype when the Pages filter is active', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'page' } ),
			undefined
		);
	} );

	it( 'narrows to the post subtype when the Posts filter is active', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Posts' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'post' } ),
			undefined
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
				saving={ false }
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
				saving={ false }
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
				saving={ false }
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
				saving={ false }
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
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Next ›' ) );
		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'page', page: 1 } ),
			undefined
		);
	} );
} );

describe( 'BrowsePane initial browse seed', () => {
	const seed = {
		records: [
			{
				id: 1,
				title: 'About',
				url: 'https://example.test/1',
				subtype: 'page',
			},
		],
		totalItems: 1,
		totalPages: 1,
	};

	it( 'offers the seed to useSearchResults on first render, while the query is still the default', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
				initialBrowse={ seed }
			/>
		);

		expect( hooks.useSearchResults ).toHaveBeenCalledWith(
			expect.objectContaining( { search: '', page: 1 } ),
			seed
		);
	} );

	it( 'stops offering the seed once the type filter diverges from the default "All" query', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
				initialBrowse={ seed }
			/>
		);

		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'page' } ),
			undefined
		);
	} );

	it( 'stops offering the seed once paging past the first page', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
				initialBrowse={ seed }
			/>
		);

		fireEvent.click( screen.getByText( 'Next ›' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { page: 2 } ),
			undefined
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
				saving={ false }
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
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Next ›' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { page: 2 } ),
			undefined
		);
	} );

	it( 'disables both pager buttons while a fetch is in flight, even mid-collection', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3, true ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByText( '‹ Prev' ) ).toBeDisabled();
		expect( screen.getByText( 'Next ›' ) ).toBeDisabled();
	} );
} );

describe( 'BrowsePane busy state', () => {
	it( 'shows a busy indicator instead of rows while the query is in flight — including on first mount', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1, true ) );

		const { container } = render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect( container.querySelector( '.bsb-browse__busy' ) ).toBeTruthy();
		expect( container.querySelector( '.components-spinner' ) ).toBeTruthy();
	} );

	it( 'never shows the previous query’s rows while a new fetch is resolving', () => {
		hooks.useSearchResults.mockReturnValue(
			result(
				[ { id: 1, title: 'Stale Page', subtype: 'page' } ],
				1,
				1,
				true
			)
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		// Even though the mocked hook still hands back the stale record (the
		// real hook keeps the last resolved records while re-resolving),
		// BrowsePane must not render it while isResolving is true.
		expect( screen.queryByText( 'Stale Page' ) ).not.toBeInTheDocument();
	} );

	it( 'does not show the empty state while resolving, even with zero records', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1, true ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect(
			screen.queryByText( 'No pages or posts match your search.' )
		).not.toBeInTheDocument();
	} );

	it( 'shows the empty state only once settled with zero records', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1, false ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect(
			screen.getByText( 'No pages or posts match your search.' )
		).toBeInTheDocument();
	} );

	it( 'renders the rows once the query settles', () => {
		hooks.useSearchResults.mockReturnValue(
			result(
				[ { id: 1, title: 'About', subtype: 'page' } ],
				1,
				1,
				false
			)
		);

		const { container } = render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByText( 'About' ) ).toBeInTheDocument();
		expect( container.querySelector( '.bsb-browse__busy' ) ).toBeFalsy();
	} );

	it( 'empties the meta line while resolving, rather than a stale count or a "Loading…" label', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3, true ) );

		const { container } = render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.queryByText( /30 items/ ) ).not.toBeInTheDocument();
		expect( screen.queryByText( 'Loading…' ) ).not.toBeInTheDocument();
		// The spinner in the results container is the one busy indicator; the
		// meta line itself goes empty (a non-breaking space, so its height
		// stays reserved) rather than showing any text of its own.
		expect(
			container.querySelector( '.bsb-browse__meta' )?.textContent?.trim()
		).toBe( '' );
	} );

	it( 'restores the item count in the meta line once the query settles', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3, false ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByText( /30 items/ ) ).toBeInTheDocument();
	} );
} );

describe( 'BrowsePane fetch errors', () => {
	// The actual error surfaces as the screen's shared bottom toast (owned by
	// `SettingsApp`, not this pane) — this pane's own job is only to report
	// the failure upward and otherwise fall through to its ordinary
	// spinner/empty/rows states, covered below.

	it( 'reports a failed request to onFetchError', () => {
		const onFetchError = vi.fn();
		hooks.useSearchResults.mockReturnValue(
			result( [], 0, 1, false, true )
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
				onFetchError={ onFetchError }
			/>
		);

		expect( onFetchError ).toHaveBeenCalledWith( true );
	} );

	it( 'reports the request as no longer failing once it settles successfully', () => {
		const onFetchError = vi.fn();
		hooks.useSearchResults.mockReturnValue(
			result( [], 0, 1, false, false )
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
				onFetchError={ onFetchError }
			/>
		);

		expect( onFetchError ).toHaveBeenCalledWith( false );
	} );

	it( 'renders no error text of its own; a failed request falls through to the same empty-state a genuine no-matches result shows', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [], 0, 1, false, true )
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect(
			screen.getByText( 'No pages or posts match your search.' )
		).toBeInTheDocument();
		expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
	} );

	it( 'works with no onFetchError prop at all (the default in every test above)', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [], 0, 1, false, true )
		);

		expect( () =>
			render(
				<BrowsePane
					postTypes={ [ 'page', 'post' ] }
					selectedIds={ new Set() }
					saving={ false }
					onAdd={ vi.fn() }
				/>
			)
		).not.toThrow();
	} );
} );

describe( 'BrowsePane save-in-progress guard', () => {
	it( 'shields the pane with an overlay while a save is in flight', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		const { container } = render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving
				onAdd={ vi.fn() }
			/>
		);

		expect(
			container.querySelector( '.bsb-pane-overlay' )
		).toBeInTheDocument();
	} );

	it( 'renders no overlay while not saving', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		const { container } = render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving={ false }
				onAdd={ vi.fn() }
			/>
		);

		expect(
			container.querySelector( '.bsb-pane-overlay' )
		).not.toBeInTheDocument();
	} );

	it( 'disables every Add button while saving', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving
				onAdd={ vi.fn() }
			/>
		);

		expect( screen.getByRole( 'button', { name: 'Add' } ) ).toBeDisabled();
	} );

	it( 'disables the pager while saving', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				saving
				onAdd={ vi.fn() }
			/>
		);

		expect(
			screen.getByRole( 'button', { name: 'Next ›' } )
		).toBeDisabled();
	} );
} );
