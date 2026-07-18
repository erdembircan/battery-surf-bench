import { describe, it, expect, vi, afterEach } from 'vitest';
import { whenDocumentLoaded } from '@/surfer/PageLoad';

/**
 * jsdom's `document.readyState` is a getter with no setter; redefining the
 * property is the only way a test can simulate "still loading".
 * @param state
 */
const setReadyState = ( state: DocumentReadyState ): void => {
	Object.defineProperty( document, 'readyState', {
		value: state,
		configurable: true,
	} );
};

afterEach( () => {
	setReadyState( 'complete' );
} );

describe( 'whenDocumentLoaded', () => {
	it( 'calls back synchronously when the document has already loaded', () => {
		setReadyState( 'complete' );
		const callback = vi.fn();

		whenDocumentLoaded( window, callback );

		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'defers the callback to the load event while still loading', () => {
		setReadyState( 'loading' );
		const callback = vi.fn();

		whenDocumentLoaded( window, callback );
		expect( callback ).not.toHaveBeenCalled();

		window.dispatchEvent( new Event( 'load' ) );

		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'fires only once even if the load event fires again', () => {
		setReadyState( 'loading' );
		const callback = vi.fn();

		whenDocumentLoaded( window, callback );
		window.dispatchEvent( new Event( 'load' ) );
		window.dispatchEvent( new Event( 'load' ) );

		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );
} );
