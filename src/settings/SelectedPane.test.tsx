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
import { SelectedPane } from './SelectedPane';
import type { SequenceRow } from './Types';

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
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'SelectedPane remove', () => {
	it( 'marks the row is-removing immediately, and keeps it mounted rather than removing it outright', () => {
		render(
			<SelectedPane
				rows={ [ bundledRow, userRow ] }
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
