/**
 * Behavioral tests for the Selected pane's remove flow.
 *
 * Removal is asynchronous — it plays a collapse animation before committing —
 * so what matters here is the observable timing contract: `onRemove` fires
 * once the animation finishes, and never fires (nor throws) if the pane is
 * gone before that timer runs, which is the leak the pending-timer ref guards
 * against.
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

beforeEach( () => {
	vi.useFakeTimers();
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'SelectedPane remove', () => {
	it( 'commits the removal only after the collapse animation finishes', () => {
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

		expect( onRemove ).not.toHaveBeenCalled();

		vi.advanceTimersByTime( 190 );

		expect( onRemove ).toHaveBeenCalledWith( { kind: 'user', id: 5 } );
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

		vi.advanceTimersByTime( 190 );

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

		// If the timer were not cancelled on unmount, advancing past its delay
		// here would still fire `onRemove` against the unmounted component.
		vi.advanceTimersByTime( 500 );

		expect( onRemove ).not.toHaveBeenCalled();
	} );
} );
