/**
 * Behavioral tests for the settings app's orchestration: wiring the Browse and
 * Selected panes to the order state, and saving it through the core-data
 * site-settings entity.
 *
 * The panes themselves (query args, drag-reorder, row rendering) are covered
 * by their own tests (`BrowsePane.test.tsx`, `Order.test.ts`,
 * `RowMapping.test.ts`); here they are replaced with minimal stubs that
 * expose the handlers App wires to them, so what is asserted is App's own
 * observable contract: what it renders into the Selected pane, what it saves,
 * and how it reflects dirty/saving/saved state through the portaled Save
 * button.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SettingsConfig } from './Types';

const hooks = vi.hoisted( () => ( {
	useEntityRecord: vi.fn(),
	edit: vi.fn(),
	save: vi.fn(),
} ) );

vi.mock( '@wordpress/core-data', () => ( {
	useEntityRecord: hooks.useEntityRecord,
} ) );

vi.mock( './BrowsePane', () => ( {
	BrowsePane: ( {
		onAdd,
	}: {
		onAdd: ( id: number, type: string, title: string ) => void;
	} ) => (
		<button onClick={ () => onAdd( 5, 'page', 'Pricing' ) }>
			stub-add
		</button>
	),
} ) );

vi.mock( './SelectedPane', () => ( {
	SelectedPane: ( {
		rows,
		onRemove,
	}: {
		rows: Array< { key: string; title: string; entry: unknown } >;
		onRemove: ( entry: unknown ) => void;
	} ) => (
		<div>
			<span data-testid="row-count">{ rows.length }</span>
			{ rows.map( ( row ) => (
				<div key={ row.key }>
					{ row.title }
					<button onClick={ () => onRemove( row.entry ) }>
						remove-{ row.key }
					</button>
				</div>
			) ) }
		</div>
	),
} ) );

vi.mock( './UserPageResolver', () => ( {
	UserPageResolver: () => null,
} ) );

const { SettingsApp } = await import( './App' );

const config: SettingsConfig = {
	postTypes: [ 'page', 'post' ],
	optionKey: 'bsb_course_order',
	courseOrder: [ { kind: 'bundled', slug: 'article-1' } ],
	bundledCatalog: [
		{ slug: 'article-1', title: 'The Hidden Cost of a Browser Tab' },
	],
	initialBrowse: { records: [], totalItems: 0, totalPages: 1 },
};

/**
 * Renders the app with a save slot present in the DOM, the way the PHP view
 * renders it in the header.
 *
 * @return The injected slot element.
 */
function renderWithSaveSlot() {
	const slot = document.createElement( 'span' );
	slot.className = 'bsb-settings__save-slot';
	document.body.appendChild( slot );
	render( <SettingsApp config={ config } /> );
	return slot;
}

beforeEach( () => {
	hooks.edit.mockReset();
	hooks.save.mockReset().mockResolvedValue( undefined );
	hooks.useEntityRecord.mockReturnValue( {
		edit: hooks.edit,
		save: hooks.save,
	} );
	document.body.innerHTML = '';
} );

describe( 'SettingsApp sequence state', () => {
	it( 'seeds the sequence from the localized order, healed against the bundled catalog', () => {
		renderWithSaveSlot();

		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '1' );
		expect(
			screen.getByText( 'The Hidden Cost of a Browser Tab' )
		).toBeInTheDocument();
	} );

	it( 'adding a browsed page grows the sequence', () => {
		renderWithSaveSlot();

		fireEvent.click( screen.getByText( 'stub-add' ) );

		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '2' );
		expect( screen.getByText( 'Pricing' ) ).toBeInTheDocument();
	} );

	it( 'removing a user page shrinks the sequence back down', () => {
		renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );

		fireEvent.click( screen.getByText( 'remove-user:5' ) );

		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '1' );
		expect( screen.queryByText( 'Pricing' ) ).not.toBeInTheDocument();
	} );
} );

describe( 'SettingsApp save button', () => {
	it( 'portals a disabled Save button before any change is made', () => {
		const slot = renderWithSaveSlot();

		expect( slot.querySelector( 'button' ) ).toBeDisabled();
	} );

	it( 'enables Save once the sequence has changed', () => {
		const slot = renderWithSaveSlot();

		fireEvent.click( screen.getByText( 'stub-add' ) );

		expect( slot.querySelector( 'button' ) ).not.toBeDisabled();
	} );

	it( 'saves the current order through the site-settings entity, keyed by the localized option key', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );

		fireEvent.click( slot.querySelector( 'button' )! );

		await waitFor( () => expect( hooks.save ).toHaveBeenCalledTimes( 1 ) );
		expect( hooks.edit ).toHaveBeenCalledWith( {
			bsb_course_order: [
				{ kind: 'bundled', slug: 'article-1' },
				{ kind: 'user', id: 5 },
			],
		} );
	} );

	it( 'disables Save again and shows the Saved flash once the save resolves', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( 'button' )! );

		await waitFor( () =>
			expect( slot.querySelector( 'button' ) ).toBeDisabled()
		);
		expect( slot.textContent ).toContain( 'Saved' );
	} );
} );
