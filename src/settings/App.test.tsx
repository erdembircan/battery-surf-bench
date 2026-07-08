/**
 * Behavioral tests for the settings app's orchestration: wiring the Browse and
 * Selected panes to the order state, and saving it with a direct
 * `/wp/v2/settings` POST.
 *
 * The panes themselves (query args, drag-reorder, row rendering) are covered
 * by their own tests (`BrowsePane.test.tsx`, `Order.test.ts`,
 * `RowMapping.test.ts`); here they are replaced with minimal stubs that
 * expose the handlers App wires to them, so what is asserted is App's own
 * observable contract: what it renders into the Selected pane, what it saves,
 * and how it reflects dirty/saving state through the portaled Save button.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	render,
	screen,
	fireEvent,
	waitFor,
	within,
} from '@testing-library/react';
import type { SettingsConfig } from './Types';

const hooks = vi.hoisted( () => ( {
	apiFetch: vi.fn(),
} ) );

vi.mock( '@wordpress/api-fetch', () => ( {
	default: hooks.apiFetch,
} ) );

vi.mock( './BrowsePane', () => ( {
	BrowsePane: ( {
		saving,
		onAdd,
		onFetchError,
	}: {
		saving: boolean;
		onAdd: ( id: number, type: string, title: string ) => void;
		onFetchError?: ( isError: boolean ) => void;
	} ) => (
		<>
			<span data-testid="browse-saving">{ String( saving ) }</span>
			<button onClick={ () => onAdd( 5, 'page', 'Pricing' ) }>
				stub-add
			</button>
			<button onClick={ () => onAdd( 6, 'page', 'Other' ) }>
				stub-add-other
			</button>
			<button onClick={ () => onFetchError?.( true ) }>
				stub-fetch-error
			</button>
			<button onClick={ () => onFetchError?.( false ) }>
				stub-fetch-recover
			</button>
		</>
	),
} ) );

vi.mock( './SelectedPane', () => ( {
	SelectedPane: ( {
		rows,
		saving,
		onRemove,
		onReorder,
	}: {
		rows: Array< { key: string; title: string; entry: unknown } >;
		saving: boolean;
		onRemove: ( entry: unknown ) => void;
		onReorder: ( activeKey: string, overKey: string ) => void;
	} ) => (
		<div>
			<span data-testid="selected-saving">{ String( saving ) }</span>
			<span data-testid="row-count">{ rows.length }</span>
			{ rows.length >= 2 && (
				<button
					onClick={ () => onReorder( rows[ 0 ].key, rows[ 1 ].key ) }
				>
					stub-reorder
				</button>
			) }
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
	userPages: {},
};

/**
 * Renders the app with a save slot present in the DOM, the way the PHP view
 * renders it in the header.
 *
 * @param overrides Partial config overriding the shared default, for tests
 *                  that need a different saved order or seed.
 * @return The injected slot element.
 */
function renderWithSaveSlot( overrides: Partial< SettingsConfig > = {} ) {
	const slot = document.createElement( 'span' );
	slot.className = 'bsb-settings__save-slot';
	document.body.appendChild( slot );
	render( <SettingsApp config={ { ...config, ...overrides } } /> );
	return slot;
}

/**
 * Makes the next `apiFetch` call hang until the returned resolver is invoked,
 * so a test can assert on the state while a save is genuinely still in
 * flight.
 *
 * @return The resolver that settles the pending save.
 */
function holdNextSave(): () => void {
	let resolveSave: () => void = () => {};
	hooks.apiFetch.mockImplementation(
		() =>
			new Promise< void >( ( resolve ) => {
				resolveSave = resolve;
			} )
	);
	return () => resolveSave();
}

beforeEach( () => {
	hooks.apiFetch.mockReset().mockResolvedValue( undefined );
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

describe( 'SettingsApp seeded user page titles', () => {
	it( 'renders a saved user page from its server-seeded title on first render, never the raw id', () => {
		renderWithSaveSlot( {
			courseOrder: [
				{ kind: 'bundled', slug: 'article-1' },
				{ kind: 'user', id: 5 },
			],
			userPages: { 5: { title: 'Contact', type: 'page' } },
		} );

		expect( screen.getByText( 'Contact' ) ).toBeInTheDocument();
		expect( screen.queryByText( '5' ) ).not.toBeInTheDocument();
		expect( screen.queryByText( '#5' ) ).not.toBeInTheDocument();
	} );

	it( 'shows a neutral placeholder, never the raw id, for a user page with no seeded or resolved title', () => {
		renderWithSaveSlot( {
			courseOrder: [
				{ kind: 'bundled', slug: 'article-1' },
				{ kind: 'user', id: 99 },
			],
		} );

		expect( screen.getByText( '—' ) ).toBeInTheDocument();
		expect( screen.queryByText( '99' ) ).not.toBeInTheDocument();
		expect( screen.queryByText( '#99' ) ).not.toBeInTheDocument();
	} );
} );

describe( 'SettingsApp save button', () => {
	it( 'portals a disabled Save button before any change is made', () => {
		const slot = renderWithSaveSlot();

		expect( slot.querySelector( '.bsb-admin-pill--solid' ) ).toBeDisabled();
	} );

	it( 'enables Save once the sequence has changed', () => {
		const slot = renderWithSaveSlot();

		fireEvent.click( screen.getByText( 'stub-add' ) );

		expect(
			slot.querySelector( '.bsb-admin-pill--solid' )
		).not.toBeDisabled();
	} );

	it( 'saves the current order with a POST to the core settings endpoint, keyed by the localized option key', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );

		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		await waitFor( () =>
			expect( hooks.apiFetch ).toHaveBeenCalledTimes( 1 )
		);
		expect( hooks.apiFetch ).toHaveBeenCalledWith( {
			path: '/wp/v2/settings',
			method: 'POST',
			data: {
				bsb_course_order: [
					{ kind: 'bundled', slug: 'article-1' },
					{ kind: 'user', id: 5 },
				],
			},
		} );
	} );

	it( 'disables Save again once the save resolves', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		await waitFor( () =>
			expect(
				slot.querySelector( '.bsb-admin-pill--solid' )
			).toBeDisabled()
		);
	} );

	it( 'returns saving to false and keeps the sequence dirty and retry-able when the save fails', async () => {
		const consoleError = vi
			.spyOn( console, 'error' )
			.mockImplementation( () => {} );
		hooks.apiFetch
			.mockReset()
			.mockRejectedValue( new Error( 'network error' ) );
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );

		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		await waitFor( () =>
			expect( hooks.apiFetch ).toHaveBeenCalledTimes( 1 )
		);
		await waitFor( () =>
			expect(
				slot.querySelector( '.bsb-admin-pill--solid' )
			).not.toBeDisabled()
		);

		consoleError.mockRestore();
	} );
} );

describe( 'SettingsApp save outcome notice', () => {
	afterEach( () => {
		vi.useRealTimers();
	} );

	it( 'shows a success notice once a save resolves', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		const notice = await screen.findByRole( 'status' );
		expect( notice ).toHaveTextContent( 'Saved' );
		expect( notice ).toHaveClass( 'is-success' );
	} );

	it( 'auto-dismisses the success notice after a few seconds', async () => {
		vi.useFakeTimers( { shouldAdvanceTime: true } );
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		await vi.waitFor( () =>
			expect( screen.getByRole( 'status' ) ).toBeInTheDocument()
		);

		await vi.advanceTimersByTimeAsync( 10000 );

		expect( screen.queryByRole( 'status' ) ).not.toBeInTheDocument();
	} );

	it( 'shows a persistent error notice when a save fails, with no auto-dismiss', async () => {
		vi.useFakeTimers( { shouldAdvanceTime: true } );
		const consoleError = vi
			.spyOn( console, 'error' )
			.mockImplementation( () => {} );
		hooks.apiFetch
			.mockReset()
			.mockRejectedValue( new Error( 'network error' ) );
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		const notice = await vi.waitFor( () => screen.getByRole( 'alert' ) );
		expect( notice ).toHaveTextContent( 'Save failed' );
		expect( notice ).toHaveClass( 'is-error' );

		await vi.advanceTimersByTimeAsync( 60000 );

		expect( screen.getByRole( 'alert' ) ).toBeInTheDocument();

		consoleError.mockRestore();
	} );

	it( 'dismisses the notice when its close control is activated', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		const notice = await screen.findByRole( 'status' );
		fireEvent.click(
			within( notice ).getByRole( 'button', { name: 'Dismiss' } )
		);

		expect( screen.queryByRole( 'status' ) ).not.toBeInTheDocument();
	} );

	it( 'clears the previous notice as soon as a new save attempt starts', async () => {
		hooks.apiFetch.mockReset().mockRejectedValueOnce( new Error( 'boom' ) );
		const consoleError = vi
			.spyOn( console, 'error' )
			.mockImplementation( () => {} );
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		await screen.findByRole( 'alert' );

		hooks.apiFetch.mockResolvedValue( undefined );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		// The stale error clears the moment the retry starts, not only once it
		// resolves.
		expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();

		await screen.findByRole( 'status' );

		consoleError.mockRestore();
	} );
} );

describe( 'SettingsApp Browse fetch-error toast', () => {
	it( 'raises a bottom error toast when the Browse pane reports a failed request', () => {
		renderWithSaveSlot();

		fireEvent.click( screen.getByText( 'stub-fetch-error' ) );

		const notice = screen.getByRole( 'alert' );
		expect( notice ).toHaveClass( 'is-error' );
		expect( notice ).toHaveTextContent( "Couldn't load content" );
	} );

	it( 'clears the fetch-error toast once the Browse pane reports recovery', () => {
		renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-fetch-error' ) );

		fireEvent.click( screen.getByText( 'stub-fetch-recover' ) );

		expect( screen.queryByRole( 'alert' ) ).not.toBeInTheDocument();
	} );

	it( "doesn't let a fetch-error toast clear a save toast raised after it", async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );
		await screen.findByRole( 'status' );

		// A fetch recovering afterwards belongs to the other source — it must
		// not clear the save-success toast that's currently showing.
		fireEvent.click( screen.getByText( 'stub-fetch-recover' ) );

		expect( screen.getByRole( 'status' ) ).toHaveTextContent( 'Saved' );
	} );
} );

describe( 'SettingsApp save-in-progress guard', () => {
	it( 'threads saving down to both panes while a save is in flight, and clears it once the save resolves', async () => {
		const resolveSave = holdNextSave();
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		expect( screen.getByTestId( 'browse-saving' ) ).toHaveTextContent(
			'true'
		);
		expect( screen.getByTestId( 'selected-saving' ) ).toHaveTextContent(
			'true'
		);

		resolveSave();

		await waitFor( () =>
			expect( screen.getByTestId( 'browse-saving' ) ).toHaveTextContent(
				'false'
			)
		);
		expect( screen.getByTestId( 'selected-saving' ) ).toHaveTextContent(
			'false'
		);
	} );

	it( 'ignores an add while a save is in flight, even if the calling UI still invokes it', async () => {
		const resolveSave = holdNextSave();
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		fireEvent.click( screen.getByText( 'stub-add-other' ) );
		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '2' );

		resolveSave();
		await waitFor( () =>
			expect( screen.getByTestId( 'browse-saving' ) ).toHaveTextContent(
				'false'
			)
		);

		// The same action succeeds once the guard lifts — proving the earlier
		// click was ignored because of `saving`, not for some other reason.
		fireEvent.click( screen.getByText( 'stub-add-other' ) );
		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '3' );
	} );

	it( 'ignores a remove while a save is in flight', async () => {
		const resolveSave = holdNextSave();
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		fireEvent.click( screen.getByText( 'remove-user:5' ) );
		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '2' );

		resolveSave();
		await waitFor( () =>
			expect( screen.getByTestId( 'browse-saving' ) ).toHaveTextContent(
				'false'
			)
		);

		fireEvent.click( screen.getByText( 'remove-user:5' ) );
		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '1' );
	} );

	it( 'ignores a reorder while a save is in flight', async () => {
		const resolveSave = holdNextSave();
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		fireEvent.click( screen.getByText( 'stub-reorder' ) );

		// Unreordered: the bundled row still precedes the user row it was
		// added after.
		expect(
			document.body.innerHTML.indexOf( 'The Hidden Cost' )
		).toBeLessThan( document.body.innerHTML.indexOf( 'Pricing' ) );

		resolveSave();
		await waitFor( () =>
			expect( screen.getByTestId( 'browse-saving' ) ).toHaveTextContent(
				'false'
			)
		);

		fireEvent.click( screen.getByText( 'stub-reorder' ) );
		expect( document.body.innerHTML.indexOf( 'Pricing' ) ).toBeLessThan(
			document.body.innerHTML.indexOf( 'The Hidden Cost' )
		);
	} );
} );

describe( 'SettingsApp reset button', () => {
	it( 'portals a disabled Reset button before any change is made', () => {
		const slot = renderWithSaveSlot();

		expect(
			slot.querySelector( '.bsb-admin-pill--outline' )
		).toBeDisabled();
	} );

	it( 'enables Reset once the sequence has changed', () => {
		const slot = renderWithSaveSlot();

		fireEvent.click( screen.getByText( 'stub-add' ) );

		expect(
			slot.querySelector( '.bsb-admin-pill--outline' )
		).not.toBeDisabled();
	} );

	it( 'reverts the sequence and clears dirty when Reset is activated', () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '2' );

		fireEvent.click( slot.querySelector( '.bsb-admin-pill--outline' )! );

		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '1' );
		expect( screen.queryByText( 'Pricing' ) ).not.toBeInTheDocument();
		expect( slot.querySelector( '.bsb-admin-pill--solid' ) ).toBeDisabled();
		expect(
			slot.querySelector( '.bsb-admin-pill--outline' )
		).toBeDisabled();
	} );

	it( 'reverts only to the last-persisted order, not the original load, once a save has happened', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) ); // Pricing (id 5).
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		await waitFor( () =>
			expect(
				slot.querySelector( '.bsb-admin-pill--solid' )
			).toBeDisabled()
		);

		fireEvent.click( screen.getByText( 'stub-add-other' ) ); // Other (id 6).
		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '3' );

		fireEvent.click( slot.querySelector( '.bsb-admin-pill--outline' )! );

		// Reset drops the unsaved "Other" but keeps the already-saved "Pricing"
		// — proving it reverted to the last save, not the page's original load.
		expect( screen.getByTestId( 'row-count' ) ).toHaveTextContent( '2' );
		expect( screen.getByText( 'Pricing' ) ).toBeInTheDocument();
		expect( screen.queryByText( 'Other' ) ).not.toBeInTheDocument();
	} );

	it( 'disables Reset while a save is in flight, even though it was enabled a moment before', () => {
		const resolveSave = holdNextSave();
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		expect(
			slot.querySelector( '.bsb-admin-pill--outline' )
		).toBeDisabled();

		resolveSave();
	} );
} );

describe( 'SettingsApp unsaved-changes navigate guard', () => {
	/**
	 * Dispatches a cancelable `beforeunload` event on `window` and reports
	 * whether the app's handler intercepted it — the observable proxy for
	 * "the browser would have shown its native leave-confirmation".
	 *
	 * @return Whether the event was prevented.
	 */
	function dispatchBeforeUnload(): boolean {
		const event = new Event( 'beforeunload', { cancelable: true } );
		window.dispatchEvent( event );
		return event.defaultPrevented;
	}

	it( 'does nothing on an unmodified, freshly loaded sequence', () => {
		renderWithSaveSlot();

		expect( dispatchBeforeUnload() ).toBe( false );
	} );

	it( 'intercepts the navigate once the sequence has unsaved changes', () => {
		renderWithSaveSlot();

		fireEvent.click( screen.getByText( 'stub-add' ) );

		expect( dispatchBeforeUnload() ).toBe( true );
	} );

	it( 'stops intercepting once the change is saved', async () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		await waitFor( () =>
			expect(
				slot.querySelector( '.bsb-admin-pill--solid' )
			).toBeDisabled()
		);

		expect( dispatchBeforeUnload() ).toBe( false );
	} );

	it( 'stops intercepting once the change is reset', () => {
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );

		fireEvent.click( slot.querySelector( '.bsb-admin-pill--outline' )! );

		expect( dispatchBeforeUnload() ).toBe( false );
	} );

	it( 'does not intercept while a save is already in flight, resolving the very same unsaved state', () => {
		const resolveSave = holdNextSave();
		const slot = renderWithSaveSlot();
		fireEvent.click( screen.getByText( 'stub-add' ) );
		fireEvent.click( slot.querySelector( '.bsb-admin-pill--solid' )! );

		// `saving` is true and a save for this exact state is already
		// underway — the guard steps aside rather than doubling up.
		expect( dispatchBeforeUnload() ).toBe( false );

		resolveSave();
	} );
} );
