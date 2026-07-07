/**
 * Behavioral tests for the shared admin `<Notice>`: each kind renders its own
 * shape (class + role), the message is free text, and dismissal is optional
 * but wired through when offered.
 */

import { describe, it, expect, vi } from 'vitest';
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
