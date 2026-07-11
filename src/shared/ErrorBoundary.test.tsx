/**
 * Behavioral tests for `ErrorBoundary`: renders its children normally, and
 * falls back to an error `<Notice>` plus a working Reload control instead of
 * a blank screen when a descendant throws during render.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

/** A component that throws during render, to exercise the boundary's fallback. */
function Bomb(): never {
	throw new Error( 'boom' );
}

afterEach( () => {
	vi.restoreAllMocks();
} );

describe( 'ErrorBoundary', () => {
	it( 'renders its children when nothing throws', () => {
		render(
			<ErrorBoundary>
				<p>All good</p>
			</ErrorBoundary>
		);

		expect( screen.getByText( 'All good' ) ).toBeInTheDocument();
	} );

	it( 'renders an error notice instead of a blank screen when a child throws', () => {
		// React logs the caught error to the console on its own; this is not the
		// boundary's own componentDidCatch logging under test here.
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );

		render(
			<ErrorBoundary>
				<Bomb />
			</ErrorBoundary>
		);

		expect( screen.getByRole( 'alert' ) ).toHaveTextContent(
			'Something went wrong loading this screen.'
		);
		expect( screen.queryByText( 'All good' ) ).not.toBeInTheDocument();
	} );

	it( 'logs the crash for developers', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );

		render(
			<ErrorBoundary>
				<Bomb />
			</ErrorBoundary>
		);

		// eslint-disable-next-line no-console
		expect( console.error ).toHaveBeenCalledWith(
			'Battery Surf Bench admin screen crashed',
			expect.any( Error ),
			expect.anything()
		);
	} );

	it( "reloads the page when the fallback's Reload control is activated", () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		const reload = vi.fn();
		Object.defineProperty( window, 'location', {
			value: { ...window.location, reload },
			writable: true,
		} );

		render(
			<ErrorBoundary>
				<Bomb />
			</ErrorBoundary>
		);

		fireEvent.click( screen.getByRole( 'button', { name: 'Reload' } ) );

		expect( reload ).toHaveBeenCalledTimes( 1 );
	} );
} );
