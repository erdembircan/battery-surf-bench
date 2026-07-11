/**
 * Behavioral tests for the Selected pane's remove flow.
 *
 * Removal is asynchronous — it plays a collapse animation before committing —
 * so what matters here is the observable timing contract: the row gets an
 * `is-removing` class and stays mounted while it collapses, `onRemove` fires
 * once that collapse actually finishes (or, failing that, once a fallback
 * timeout elapses), and never fires (nor throws) if the pane is gone before
 * either of those happens — the leak the pending-removal ref guards against.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SequenceRow } from './Types';

// `isDragging` only ever flips true from inside a real pointer/keyboard drag
// gesture, which jsdom cannot meaningfully simulate (dnd-kit's sensors lean on
// real pointer capture and element geometry). Everything else from
// `@dnd-kit/sortable` — `SortableContext`, the real drag-settle `transition`,
// etc. — stays real; only `useSortable`'s `isDragging` is overridden, per row
// id, so the placeholder tests exercise the actual mapping from that flag to
// the `is-drag-placeholder` class — including that it lands on the dragged
// row alone, not every row — the same boundary-mocking `BrowsePane.test.tsx`
// uses for its own data-layer hook.
const dndKit = vi.hoisted( () => ( { draggingId: null as string | null } ) );

vi.mock( '@dnd-kit/sortable', async () => {
	const actual =
		await vi.importActual< typeof import('@dnd-kit/sortable') >(
			'@dnd-kit/sortable'
		);
	return {
		...actual,
		// Wrapped in `vi.fn()` (not just a plain replacement function) so tests
		// can also assert on what it was called with — e.g. that `disabled`
		// reaches it while a save is in flight.
		useSortable: vi.fn(
			( args: Parameters< typeof actual.useSortable >[ 0 ] ) => ( {
				...actual.useSortable( args ),
				isDragging: args.id === dndKit.draggingId,
			} )
		),
	};
} );

const { SelectedPane } = await import( './SelectedPane' );

const bundledRow: SequenceRow = {
	key: 'bundled:article-1',
	title: 'The Hidden Cost of a Browser Tab',
	badge: 'bundled',
	removable: false,
	entry: { kind: 'bundled', slug: 'article-1' },
};

const userRow: SequenceRow = {
	key: 'user:5',
	title: 'Pricing',
	badge: 'page',
	removable: true,
	entry: { kind: 'user', id: 5 },
};

/**
 * Finds the DOM row a "Remove <title>" button lives in.
 *
 * @param title The row's title, as it appears in the remove button's label.
 * @return The row element.
 */
function findRow( title: string ): HTMLElement {
	return screen
		.getByRole( 'button', { name: `Remove ${ title }` } )
		.closest( '.bsb-pages-row--custom' ) as HTMLElement;
}

/**
 * Finds the DOM row carrying the given title text — unlike {@link findRow},
 * this also works for a locked bundled row, which has no remove button.
 *
 * @param title The row's title.
 * @return The row element.
 */
function findRowByTitle( title: string ): HTMLElement {
	return screen
		.getByText( title, { selector: '.bsb-pages-row__title' } )
		.closest( '.bsb-pages-row--custom' ) as HTMLElement;
}

/**
 * Fires a `transitionend` event carrying the given `propertyName` — jsdom has
 * no `TransitionEvent` constructor, so `fireEvent.transitionEnd()`'s init
 * dict silently drops that field (a plain `Event`'s constructor ignores
 * unrecognized init keys); defining it directly on a plain `Event` instead is
 * what actually reaches the component's `event.propertyName` read.
 *
 * @param row          The row element the event fires on.
 * @param propertyName The CSS property to report as having finished.
 */
function fireTransitionEnd( row: HTMLElement, propertyName: string ): void {
	const event = new Event( 'transitionend', {
		bubbles: true,
		cancelable: true,
	} );
	Object.defineProperty( event, 'propertyName', { value: propertyName } );
	fireEvent( row, event );
}

beforeEach( () => {
	vi.useFakeTimers();
	dndKit.draggingId = null;
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'SelectedPane remove', () => {
	it( 'marks the row is-removing immediately, and keeps it mounted rather than removing it outright', () => {
		render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
				saving={ false }
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		const row = findRow( 'Pricing' );
		expect( row ).not.toHaveClass( 'is-removing' );

		fireEvent.click(
			screen.getByRole( 'button', { name: 'Remove Pricing' } )
		);

		expect( row ).toHaveClass( 'is-removing' );
		expect( row ).toBeInTheDocument();
	} );

	it( 'commits the removal once the row’s own collapse transition finishes', () => {
		const onRemove = vi.fn();
		render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
				saving={ false }
				onRemove={ onRemove }
				onReorder={ vi.fn() }
			/>
		);

		fireEvent.click(
			screen.getByRole( 'button', { name: 'Remove Pricing' } )
		);
		const row = findRow( 'Pricing' );

		expect( onRemove ).not.toHaveBeenCalled();

		fireTransitionEnd( row, 'max-height' );

		expect( onRemove ).toHaveBeenCalledWith( { kind: 'user', id: 5 } );
	} );

	it( 'ignores a transitionend for an unrelated property, such as a reorder-settle transform', () => {
		const onRemove = vi.fn();
		render(
			<SelectedPane
				rows={ [ userRow ] }
				saving={ false }
				onRemove={ onRemove }
				onReorder={ vi.fn() }
			/>
		);

		fireEvent.click(
			screen.getByRole( 'button', { name: 'Remove Pricing' } )
		);
		const row = findRow( 'Pricing' );

		fireTransitionEnd( row, 'transform' );

		expect( onRemove ).not.toHaveBeenCalled();
	} );

	it( 'falls back to committing on a timeout when transitionend never arrives', () => {
		const onRemove = vi.fn();
		render(
			<SelectedPane
				rows={ [ userRow ] }
				saving={ false }
				onRemove={ onRemove }
				onReorder={ vi.fn() }
			/>
		);

		fireEvent.click(
			screen.getByRole( 'button', { name: 'Remove Pricing' } )
		);

		vi.advanceTimersByTime( 259 );
		expect( onRemove ).not.toHaveBeenCalled();

		vi.advanceTimersByTime( 1 );
		expect( onRemove ).toHaveBeenCalledWith( { kind: 'user', id: 5 } );
	} );

	it( 'never double-commits when both transitionend and the fallback timer could fire', () => {
		const onRemove = vi.fn();
		render(
			<SelectedPane
				rows={ [ userRow ] }
				saving={ false }
				onRemove={ onRemove }
				onReorder={ vi.fn() }
			/>
		);

		fireEvent.click(
			screen.getByRole( 'button', { name: 'Remove Pricing' } )
		);
		const row = findRow( 'Pricing' );

		fireTransitionEnd( row, 'max-height' );
		vi.advanceTimersByTime( 500 );

		expect( onRemove ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'never offers a remove control for a locked bundled row', () => {
		render(
			<SelectedPane
				rows={ [ bundledRow ] }
				saving={ false }
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect(
			screen.queryByRole( 'button', {
				name: /Remove The Hidden Cost of a Browser Tab/,
			} )
		).not.toBeInTheDocument();
	} );

	it( 'ignores a second remove click on the same row while it is still animating', () => {
		const onRemove = vi.fn();
		render(
			<SelectedPane
				rows={ [ userRow ] }
				saving={ false }
				onRemove={ onRemove }
				onReorder={ vi.fn() }
			/>
		);

		const removeButton = screen.getByRole( 'button', {
			name: 'Remove Pricing',
		} );
		fireEvent.click( removeButton );
		fireEvent.click( removeButton );

		vi.advanceTimersByTime( 260 );

		expect( onRemove ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'never calls onRemove for a pending timer once the pane has unmounted', () => {
		const onRemove = vi.fn();
		const { unmount } = render(
			<SelectedPane
				rows={ [ userRow ] }
				saving={ false }
				onRemove={ onRemove }
				onReorder={ vi.fn() }
			/>
		);

		fireEvent.click(
			screen.getByRole( 'button', { name: 'Remove Pricing' } )
		);

		unmount();

		// If the fallback timer were not cancelled on unmount, advancing past its
		// delay here would still fire `onRemove` against the unmounted component.
		vi.advanceTimersByTime( 500 );

		expect( onRemove ).not.toHaveBeenCalled();
	} );
} );

describe( 'SelectedPane drag placeholder', () => {
	it( 'marks only the dragged row a placeholder, leaving the rest normal', () => {
		dndKit.draggingId = userRow.key;

		render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
				saving={ false }
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		// The placeholder empties its content via `& > * { visibility: hidden; }`
		// in `style.scss` — an emptied box, not a faded copy of the row (an
		// earlier round matched the mock's `.bsb-drag-ghost` faded-copy look,
		// but the maintainer deliberately overrode that). External stylesheets
		// aren't loaded in this jsdom test environment, so that CSS effect
		// itself isn't observable here; what's under test is the class mapping
		// that drives it — the dragged row alone gets `is-drag-placeholder`.
		expect( findRow( 'Pricing' ) ).toHaveClass( 'is-drag-placeholder' );
		expect(
			findRowByTitle( 'The Hidden Cost of a Browser Tab' )
		).not.toHaveClass( 'is-drag-placeholder' );
	} );

	it( 'never marks a row a drag placeholder while nothing is being dragged', () => {
		render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
				saving={ false }
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect( findRow( 'Pricing' ) ).not.toHaveClass( 'is-drag-placeholder' );
	} );

	it( 'marks a locked bundled row a placeholder too — bundled rows are only locked against removal, not reordering', () => {
		dndKit.draggingId = bundledRow.key;

		render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
				saving={ false }
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect(
			findRowByTitle( 'The Hidden Cost of a Browser Tab' )
		).toHaveClass( 'is-drag-placeholder' );
	} );
} );

describe( 'SelectedPane save-in-progress guard', () => {
	it( 'shields the pane with an overlay while a save is in flight', () => {
		const { container } = render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
				saving
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect(
			container.querySelector( '.bsb-pane-overlay' )
		).toBeInTheDocument();
	} );

	it( 'renders no overlay while not saving', () => {
		const { container } = render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
				saving={ false }
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect(
			container.querySelector( '.bsb-pane-overlay' )
		).not.toBeInTheDocument();
	} );

	it( "disables a removable row's remove button while saving", () => {
		render(
			<SelectedPane
				rows={ [ userRow ] }
				saving
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect(
			screen.getByRole( 'button', { name: 'Remove Pricing' } )
		).toBeDisabled();
	} );

	it( 'disables the move-down affordance on a row that could otherwise move, while saving', () => {
		render(
			<SelectedPane
				rows={ [ userRow, bundledRow ] }
				saving
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect(
			screen.getByRole( 'button', { name: 'Move Pricing down' } )
		).toBeDisabled();
	} );

	it( 'passes disabled to useSortable while saving, so drag pickup is blocked', async () => {
		const dndSortable = await import( '@dnd-kit/sortable' );

		render(
			<SelectedPane
				rows={ [ userRow ] }
				saving
				onRemove={ vi.fn() }
				onReorder={ vi.fn() }
			/>
		);

		expect( dndSortable.useSortable ).toHaveBeenCalledWith(
			expect.objectContaining( { id: userRow.key, disabled: true } )
		);
	} );
} );
