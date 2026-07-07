/**
 * Behavioral tests for the Browse pane's query args and pager.
 *
 * `useEntityRecords` is `BrowsePane`'s data source, so — following the pattern
 * `src/sessions/App.test.tsx` uses for DataViews — the query args it is called
 * with, and what it reports back (totals, resolving), are the observable
 * contract asserted here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const hooks = vi.hoisted( () => ( {
	useEntityRecords: vi.fn(),
} ) );

vi.mock( '@wordpress/core-data', () => ( {
	useEntityRecords: hooks.useEntityRecords,
} ) );

const { BrowsePane } = await import( './BrowsePane' );

/**
 * A representative resolved query result for a single post type.
 * @param records
 * @param totalItems
 * @param totalPages
 * @param isResolving
 */
function result(
	records: Array< { id: number; title: string; type: string } >,
	totalItems: number,
	totalPages: number,
	isResolving = false
) {
	return {
		records: records.map( ( item ) => ( {
			id: item.id,
			title: { rendered: item.title },
			type: item.type,
		} ) ),
		totalItems,
		totalPages,
		isResolving,
	};
}

beforeEach( () => {
	hooks.useEntityRecords.mockReset();
} );

describe( 'BrowsePane queries', () => {
	it( 'queries both selectable post types on first render (the "All" filter)', () => {
		hooks.useEntityRecords.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		expect( hooks.useEntityRecords ).toHaveBeenCalledWith(
			'postType',
			'page',
			expect.objectContaining( {
				search: '',
				page: 1,
				per_page: 10,
				status: 'publish',
			} ),
			{ enabled: true }
		);
		expect( hooks.useEntityRecords ).toHaveBeenCalledWith(
			'postType',
			'post',
			expect.objectContaining( { page: 1, per_page: 10 } ),
			{ enabled: true }
		);
	} );

	it( 'disables the post query while the Pages filter is active', () => {
		hooks.useEntityRecords.mockReturnValue( result( [], 0, 1 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Pages' ) );

		expect( hooks.useEntityRecords ).toHaveBeenCalledWith(
			'postType',
			'page',
			expect.anything(),
			{ enabled: true }
		);
		expect( hooks.useEntityRecords ).toHaveBeenLastCalledWith(
			'postType',
			'post',
			expect.anything(),
			{ enabled: false }
		);
	} );

	it( 'renders the merged records from both post types under "All"', () => {
		hooks.useEntityRecords.mockImplementation(
			( _kind: string, name: string ) =>
				name === 'page'
					? result(
							[ { id: 1, title: 'About', type: 'page' } ],
							1,
							1
					  )
					: result(
							[ { id: 2, title: 'Field Notes', type: 'post' } ],
							1,
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

	it( 'reports the combined total across both post types', () => {
		hooks.useEntityRecords.mockImplementation(
			( _kind: string, name: string ) =>
				name === 'page' ? result( [], 6, 1 ) : result( [], 4, 1 )
		);

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
		hooks.useEntityRecords.mockImplementation(
			( _kind: string, name: string ) =>
				name === 'page'
					? result(
							[ { id: 1, title: 'About', type: 'page' } ],
							1,
							1
					  )
					: result( [], 0, 1 )
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

	it( 'calls onAdd with the record id, type and title', () => {
		const onAdd = vi.fn();
		hooks.useEntityRecords.mockImplementation(
			( _kind: string, name: string ) =>
				name === 'page'
					? result(
							[ { id: 5, title: 'Pricing', type: 'page' } ],
							1,
							1
					  )
					: result( [], 0, 1 )
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
} );

describe( 'BrowsePane pager', () => {
	it( 'disables Prev on the first page and enables Next when more pages exist', () => {
		hooks.useEntityRecords.mockReturnValue( result( [], 30, 3 ) );

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
		hooks.useEntityRecords.mockReturnValue( result( [], 30, 3 ) );

		render(
			<BrowsePane
				postTypes={ [ 'page', 'post' ] }
				selectedIds={ new Set() }
				onAdd={ vi.fn() }
			/>
		);

		fireEvent.click( screen.getByText( 'Next ›' ) );

		expect( hooks.useEntityRecords ).toHaveBeenLastCalledWith(
			'postType',
			'post',
			expect.objectContaining( { page: 2 } ),
			{ enabled: true }
		);
	} );
} );
