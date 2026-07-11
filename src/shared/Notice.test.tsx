/**
 * Behavioral tests for the shared admin `<Notice>`: each kind renders its own
 * shape (class + role), the message is free text, dismissal is optional but
 * wired through when offered, and — the enter/leave lifecycle — it animates
 * in on mount and stays mounted through its animated exit rather than
 * vanishing the instant a caller asks it to hide.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from '@wordpress/element';
import { render, screen, fireEvent } from '@testing-library/react';
import { Notice } from './Notice';

describe( 'Notice', () => {
	it( 'renders the free-text message', () => {
		render( <Notice kind="error" message="Something broke" /> );

		expect( screen.getByText( 'Something broke' ) ).toBeInTheDocument();
	} );

	it.each( [
		[ 'error', 'alert' ],
		[ 'info', 'status' ],
		[ 'success', 'status' ],
	] as const )(
		'renders the %s kind with its own shape class and %s role',
		( kind, role ) => {
			render( <Notice kind={ kind } message="Message" /> );

			const notice = screen.getByRole( role );
			expect( notice ).toHaveClass( 'bsb-toast' );
			expect( notice ).toHaveClass( `is-${ kind }` );
		}
	);

	it( 'renders no dismiss control when onDismiss is omitted', () => {
		render( <Notice kind="info" message="Message" /> );

		expect( screen.queryByRole( 'button' ) ).not.toBeInTheDocument();
	} );

	it( 'fires onDismiss when the dismiss control is activated', () => {
		const onDismiss = vi.fn();
		render(
			<Notice kind="success" message="Saved" onDismiss={ onDismiss } />
		);

		fireEvent.click( screen.getByRole( 'button' ) );

		expect( onDismiss ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'uses a translated default dismiss label when none is given', () => {
		render(
			<Notice kind="error" message="Failed" onDismiss={ () => {} } />
		);

		expect(
			screen.getByRole( 'button', { name: 'Dismiss' } )
		).toBeInTheDocument();
	} );

	it( 'honours a caller-supplied dismiss label', () => {
		render(
			<Notice
				kind="error"
				message="Failed"
				onDismiss={ () => {} }
				dismissLabel="Close this error"
			/>
		);

		expect(
			screen.getByRole( 'button', { name: 'Close this error' } )
		).toBeInTheDocument();
	} );
} );

describe( 'Notice enter/leave lifecycle', () => {
	it( 'plays its enter animation on mount', () => {
		render( <Notice kind="info" message="Hi" /> );

		const notice = screen.getByRole( 'status' );
		expect( notice ).toHaveClass( 'is-entering' );
		expect( notice ).not.toHaveClass( 'is-leaving' );
	} );

	it( 'settles into the holding phase once the enter animation ends', () => {
		render( <Notice kind="info" message="Hi" /> );

		const notice = screen.getByRole( 'status' );
		fireEvent.animationEnd( notice );

		expect( notice ).toHaveClass( 'is-holding' );
		expect( notice ).not.toHaveClass( 'is-entering' );
	} );

	it( 'plays its leave animation once `visible` turns false, without unmounting yet', () => {
		const onExited = vi.fn();
		const { rerender } = render(
			<Notice kind="info" message="Hi" visible onExited={ onExited } />
		);

		rerender(
			<Notice
				kind="info"
				message="Hi"
				visible={ false }
				onExited={ onExited }
			/>
		);

		const notice = screen.getByRole( 'status' );
		expect( notice ).toHaveClass( 'is-leaving' );
		expect( onExited ).not.toHaveBeenCalled();
	} );

	it( 'calls onExited once the leave animation ends', () => {
		const onExited = vi.fn();
		const { rerender } = render(
			<Notice kind="info" message="Hi" visible onExited={ onExited } />
		);
		rerender(
			<Notice
				kind="info"
				message="Hi"
				visible={ false }
				onExited={ onExited }
			/>
		);

		fireEvent.animationEnd( screen.getByRole( 'status' ) );

		expect( onExited ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'falls back to calling onExited on a timer when no animationend fires', () => {
		vi.useFakeTimers();
		const onExited = vi.fn();
		const { rerender } = render(
			<Notice kind="info" message="Hi" visible onExited={ onExited } />
		);
		rerender(
			<Notice
				kind="info"
				message="Hi"
				visible={ false }
				onExited={ onExited }
			/>
		);

		expect( onExited ).not.toHaveBeenCalled();

		vi.advanceTimersByTime( 1000 );

		expect( onExited ).toHaveBeenCalledTimes( 1 );

		vi.useRealTimers();
	} );

	it( 'does not call onExited twice when both animationend and the fallback timer could fire', () => {
		vi.useFakeTimers();
		const onExited = vi.fn();
		const { rerender } = render(
			<Notice kind="info" message="Hi" visible onExited={ onExited } />
		);
		rerender(
			<Notice
				kind="info"
				message="Hi"
				visible={ false }
				onExited={ onExited }
			/>
		);

		fireEvent.animationEnd( screen.getByRole( 'status' ) );
		vi.advanceTimersByTime( 1000 );

		expect( onExited ).toHaveBeenCalledTimes( 1 );

		vi.useRealTimers();
	} );

	/**
	 * A minimal stand-in for how a real caller (e.g. `SettingsApp`) keeps a
	 * Notice mounted through its own exit animation: it stays rendered until
	 * `onExited` fires, at which point the harness itself unmounts it — the
	 * same "the caller decides when it's actually gone" contract `Notice`
	 * documents on its own `onExited` prop.
	 *
	 * @param props           Component props.
	 * @param props.onDismiss Called when the dismiss control inside is activated.
	 */
	function DismissHarness( { onDismiss }: { onDismiss?: () => void } ) {
		const [ mounted, setMounted ] = useState( true );
		const [ visible, setVisible ] = useState( true );

		if ( ! mounted ) {
			return null;
		}

		return (
			<Notice
				kind="success"
				message="Saved"
				visible={ visible }
				onDismiss={ () => {
					setVisible( false );
					onDismiss?.();
				} }
				onExited={ () => setMounted( false ) }
			/>
		);
	}

	it( 'requesting dismiss keeps the node mounted until its leave animation ends, then removes it', () => {
		const onDismiss = vi.fn();
		render( <DismissHarness onDismiss={ onDismiss } /> );

		fireEvent.click( screen.getByRole( 'button', { name: 'Dismiss' } ) );

		expect( onDismiss ).toHaveBeenCalledTimes( 1 );
		const notice = screen.getByRole( 'status' );
		expect( notice ).toHaveClass( 'is-leaving' );

		fireEvent.animationEnd( notice );

		expect( screen.queryByRole( 'status' ) ).not.toBeInTheDocument();
	} );
} );
