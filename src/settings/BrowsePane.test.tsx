/**
 * Behavioral tests for the Browse pane's query args, pager, and the bundled
 * catalog's "Built-in" filter.
 *
 * `useSearchResults` is `BrowsePane`'s real-content data source, so —
 * following the pattern `src/sessions/App.test.tsx` uses for DataViews — the
 * query args it is called with, and what it reports back (totals, resolving),
 * are the observable contract asserted here for real content. The bundled
 * catalog is sourced client-side (never through the search endpoint), so its
 * own tests assert on `bundledCatalog`/`selectedSlugs` props directly. The
 * hook's own request-building and header-parsing behavior is covered by
 * `SearchQuery.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { BundledCatalogEntry } from '@/settings/Types';

/** Mirrors `BrowsePane`'s own (module-private) search debounce delay. */
const SEARCH_DEBOUNCE_MS = 300;

const hooks = vi.hoisted( () => ( {
	useSearchResults: vi.fn(),
} ) );

vi.mock( '@/settings/SearchQuery', () => ( {
	useSearchResults: hooks.useSearchResults,
} ) );

const { BrowsePane } = await import( '@/settings/BrowsePane' );

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

/** A representative bundled catalog, used by tests that exercise the "Built-in" filter or the "All" tab's pin. */
const bundledCatalog: BundledCatalogEntry[] = [
	{ slug: 'article-1', title: 'The Hidden Cost of a Browser Tab' },
	{ slug: 'gallery', title: 'Inside the Machine' },
];

/**
 * Renders `BrowsePane` with representative defaults, letting a test override
 * only what it cares about.
 *
 * @param overrides Props to override the shared defaults with.
 */
function renderBrowsePane(
	overrides: Partial< Parameters< typeof BrowsePane >[ 0 ] > = {}
) {
	return render(
		<BrowsePane
			postTypes={ [ 'page', 'post' ] }
			selectedIds={ new Set() }
			bundledCatalog={ [] }
			selectedSlugs={ new Set() }
			saving={ false }
			onAdd={ vi.fn() }
			onAddBundled={ vi.fn() }
			{ ...overrides }
		/>
	);
}

beforeEach( () => {
	hooks.useSearchResults.mockReset();
} );

describe( 'BrowsePane queries', () => {
	it( 'queries both selectable subtypes as one request on first render (the "All" filter)', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane();

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

		renderBrowsePane();

		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'page' } ),
			undefined
		);
	} );

	it( 'narrows to the post subtype when the Posts filter is active', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane();

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

		renderBrowsePane();

		expect( screen.getByText( 'About' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Field Notes' ) ).toBeInTheDocument();
	} );

	it( 'reports the single query total, matching the rows shown', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 10, 1 ) );

		renderBrowsePane();

		expect( screen.getByText( /10 items/ ) ).toBeInTheDocument();
	} );

	it( 'shows an already-selected row as Added rather than offering to add it again', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		renderBrowsePane( { selectedIds: new Set( [ 1 ] ) } );

		expect( screen.getByText( 'Added' ) ).toBeInTheDocument();
		expect( screen.queryByText( 'Add' ) ).not.toBeInTheDocument();
	} );

	it( 'calls onAdd with the record id, subtype and title', () => {
		const onAdd = vi.fn();
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 5, title: 'Pricing', subtype: 'page' } ], 1, 1 )
		);

		renderBrowsePane( { onAdd } );

		fireEvent.click( screen.getByText( 'Add' ) );

		expect( onAdd ).toHaveBeenCalledWith( 5, 'page', 'Pricing' );
	} );

	it( 're-queries from page 1 when the type filter changes', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		renderBrowsePane();

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

		renderBrowsePane( { initialBrowse: seed } );

		expect( hooks.useSearchResults ).toHaveBeenCalledWith(
			expect.objectContaining( { search: '', page: 1 } ),
			seed
		);
	} );

	it( 'stops offering the seed once the type filter diverges from the default "All" query', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane( { initialBrowse: seed } );

		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { subtype: 'page' } ),
			undefined
		);
	} );

	it( 'stops offering the seed once paging past the first page', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		renderBrowsePane( { initialBrowse: seed } );

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

		renderBrowsePane();

		expect( screen.getByText( '‹ Prev' ) ).toBeDisabled();
		expect( screen.getByText( 'Next ›' ) ).not.toBeDisabled();
		expect( screen.getByText( 'Page 1 of 3' ) ).toBeInTheDocument();
	} );

	it( 'advances to the next page and re-queries with the new page number', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		renderBrowsePane();

		fireEvent.click( screen.getByText( 'Next ›' ) );

		expect( hooks.useSearchResults ).toHaveBeenLastCalledWith(
			expect.objectContaining( { page: 2 } ),
			undefined
		);
	} );

	it( 'disables both pager buttons while a fetch is in flight, even mid-collection', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3, true ) );

		renderBrowsePane();

		expect( screen.getByText( '‹ Prev' ) ).toBeDisabled();
		expect( screen.getByText( 'Next ›' ) ).toBeDisabled();
	} );

	it( 'hides the pager entirely on the "Built-in" filter', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		const { container } = renderBrowsePane( { bundledCatalog } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Built-in' } ) );

		expect(
			container.querySelector( '.bsb-browse__pager' )
		).not.toBeInTheDocument();
	} );
} );

describe( 'BrowsePane busy state', () => {
	it( 'shows a busy indicator instead of rows while the query is in flight — including on first mount', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1, true ) );

		const { container } = renderBrowsePane();

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

		renderBrowsePane();

		// Even though the mocked hook still hands back the stale record (the
		// real hook keeps the last resolved records while re-resolving),
		// BrowsePane must not render it while isResolving is true.
		expect( screen.queryByText( 'Stale Page' ) ).not.toBeInTheDocument();
	} );

	it( 'does not show the empty state while resolving, even with zero records', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1, true ) );

		renderBrowsePane();

		expect(
			screen.queryByText( 'No pages or posts match your search.' )
		).not.toBeInTheDocument();
	} );

	it( 'shows the empty state only once settled with zero records', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1, false ) );

		renderBrowsePane();

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

		const { container } = renderBrowsePane();

		expect( screen.getByText( 'About' ) ).toBeInTheDocument();
		expect( container.querySelector( '.bsb-browse__busy' ) ).toBeFalsy();
	} );

	it( 'empties the meta line while resolving, rather than a stale count or a "Loading…" label', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3, true ) );

		const { container } = renderBrowsePane();

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

		renderBrowsePane();

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

		renderBrowsePane( { onFetchError } );

		expect( onFetchError ).toHaveBeenCalledWith( true );
	} );

	it( 'reports the request as no longer failing once it settles successfully', () => {
		const onFetchError = vi.fn();
		hooks.useSearchResults.mockReturnValue(
			result( [], 0, 1, false, false )
		);

		renderBrowsePane( { onFetchError } );

		expect( onFetchError ).toHaveBeenCalledWith( false );
	} );

	it( 'renders no error text of its own; a failed request falls through to the same empty-state a genuine no-matches result shows', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [], 0, 1, false, true )
		);

		renderBrowsePane();

		expect(
			screen.getByText( 'No pages or posts match your search.' )
		).toBeInTheDocument();
		expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
	} );

	it( 'works with no onFetchError prop at all (the default in every test above)', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [], 0, 1, false, true )
		);

		expect( () => renderBrowsePane() ).not.toThrow();
	} );
} );

describe( 'BrowsePane save-in-progress guard', () => {
	it( 'shields the pane with an overlay while a save is in flight', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		const { container } = renderBrowsePane( { saving: true } );

		expect(
			container.querySelector( '.bsb-pane-overlay' )
		).toBeInTheDocument();
	} );

	it( 'renders no overlay while not saving', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		const { container } = renderBrowsePane();

		expect(
			container.querySelector( '.bsb-pane-overlay' )
		).not.toBeInTheDocument();
	} );

	it( 'disables every Add button while saving', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		renderBrowsePane( { saving: true } );

		expect( screen.getByRole( 'button', { name: 'Add' } ) ).toBeDisabled();
	} );

	it( 'disables the pager while saving', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 30, 3 ) );

		renderBrowsePane( { saving: true } );

		expect(
			screen.getByRole( 'button', { name: 'Next ›' } )
		).toBeDisabled();
	} );
} );

describe( 'BrowsePane "Built-in" filter', () => {
	it( 'renders a 4th segmented button, alongside All/Pages/Posts', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane( { bundledCatalog } );

		expect(
			screen.getByRole( 'button', { name: 'Built-in' } )
		).toBeInTheDocument();
	} );

	it( 'shows only the bundled catalog rows, badged "Built-in", none of the real-content records', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		renderBrowsePane( { bundledCatalog } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Built-in' } ) );

		expect(
			screen.getByText( 'The Hidden Cost of a Browser Tab' )
		).toBeInTheDocument();
		expect( screen.getByText( 'Inside the Machine' ) ).toBeInTheDocument();
		expect( screen.queryByText( 'About' ) ).not.toBeInTheDocument();
		expect( screen.getAllByText( 'Built-in' ).length ).toBeGreaterThan( 1 ); // The tab button plus at least one row badge.
	} );

	it( 'shows a bundled row already in the sequence as Added', () => {
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane( {
			bundledCatalog,
			selectedSlugs: new Set( [ 'article-1' ] ),
		} );

		fireEvent.click( screen.getByRole( 'button', { name: 'Built-in' } ) );

		const row = screen
			.getByText( 'The Hidden Cost of a Browser Tab' )
			.closest( '.bsb-browse__row' ) as HTMLElement;
		expect( row ).toHaveTextContent( 'Added' );
	} );

	it( 'calls onAddBundled with the slug and title when a built-in row is added', () => {
		const onAddBundled = vi.fn();
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane( { bundledCatalog, onAddBundled } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Built-in' } ) );
		fireEvent.click( screen.getAllByText( 'Add' )[ 0 ] );

		expect( onAddBundled ).toHaveBeenCalledWith(
			'article-1',
			'The Hidden Cost of a Browser Tab'
		);
	} );

	it( 'filters the built-in rows by the search box, client-side', () => {
		vi.useFakeTimers();
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane( { bundledCatalog } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Built-in' } ) );
		fireEvent.change( screen.getByPlaceholderText( /built-in/i ), {
			target: { value: 'Machine' },
		} );
		act( () => vi.advanceTimersByTime( SEARCH_DEBOUNCE_MS ) );

		expect( screen.getByText( 'Inside the Machine' ) ).toBeInTheDocument();
		expect(
			screen.queryByText( 'The Hidden Cost of a Browser Tab' )
		).not.toBeInTheDocument();

		vi.useRealTimers();
	} );

	it( 'shows a built-in-specific empty state when the search matches no bundled page', () => {
		vi.useFakeTimers();
		hooks.useSearchResults.mockReturnValue( result( [], 0, 1 ) );

		renderBrowsePane( { bundledCatalog } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Built-in' } ) );
		fireEvent.change( screen.getByPlaceholderText( /built-in/i ), {
			target: { value: 'nonexistent' },
		} );
		act( () => vi.advanceTimersByTime( SEARCH_DEBOUNCE_MS ) );

		expect(
			screen.getByText( 'No built-in pages match your search.' )
		).toBeInTheDocument();

		vi.useRealTimers();
	} );

	it( 'never calls the real search endpoint\'s rows into view on the "Built-in" filter', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		renderBrowsePane( { bundledCatalog } );

		fireEvent.click( screen.getByRole( 'button', { name: 'Built-in' } ) );

		expect( screen.queryByText( 'About' ) ).not.toBeInTheDocument();
	} );
} );

describe( 'BrowsePane "All" filter pins built-in rows on top', () => {
	it( 'renders the built-in rows above the real-content rows on page 1', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		const { container } = renderBrowsePane( { bundledCatalog } );

		const titles = Array.from(
			container.querySelectorAll( '.bsb-browse__row-title' )
		).map( ( node ) => node.textContent );

		expect( titles ).toEqual( [
			'The Hidden Cost of a Browser Tab',
			'Inside the Machine',
			'About',
		] );
	} );

	it( 'does not pin built-in rows on page 2 of the "All" filter', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 11, 2 )
		);

		renderBrowsePane( { bundledCatalog } );

		fireEvent.click( screen.getByText( 'Next ›' ) );

		expect(
			screen.queryByText( 'The Hidden Cost of a Browser Tab' )
		).not.toBeInTheDocument();
		expect( screen.getByText( 'About' ) ).toBeInTheDocument();
	} );

	it( 'never pins built-in rows on the Pages or Posts filters', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 1, 1 )
		);

		renderBrowsePane( { bundledCatalog } );

		fireEvent.click( screen.getByText( 'Pages' ) );

		expect(
			screen.queryByText( 'The Hidden Cost of a Browser Tab' )
		).not.toBeInTheDocument();
	} );

	it( 'does not let the pinned built-in rows alter the pager, which stays driven by the real query', () => {
		hooks.useSearchResults.mockReturnValue(
			result( [ { id: 1, title: 'About', subtype: 'page' } ], 25, 3 )
		);

		renderBrowsePane( { bundledCatalog } );

		expect( screen.getByText( 'Page 1 of 3' ) ).toBeInTheDocument();
		expect( screen.getByText( /25 items/ ) ).toBeInTheDocument();
	} );
} );
