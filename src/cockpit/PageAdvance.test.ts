import { describe, it, expect } from 'vitest';
import {
	isPageDoneMessage,
	nextPageIndex,
	PAGE_DONE_TYPE,
} from '@/cockpit/PageAdvance';

const ORIGIN = 'https://example.test';

/**
 * Builds a fake `message` event with the given origin and data.
 * @param origin
 * @param data
 */
const messageEvent = ( origin: string, data: unknown ): MessageEvent =>
	( { origin, data } ) as MessageEvent;

describe( 'isPageDoneMessage', () => {
	it( 'recognizes a same-origin page-done message', () => {
		expect(
			isPageDoneMessage(
				messageEvent( ORIGIN, { type: PAGE_DONE_TYPE } ),
				ORIGIN
			)
		).toBe( true );
	} );

	it( 'rejects a message from a different origin', () => {
		expect(
			isPageDoneMessage(
				messageEvent( 'https://evil.test', { type: PAGE_DONE_TYPE } ),
				ORIGIN
			)
		).toBe( false );
	} );

	it( 'rejects a same-origin message of a different shape', () => {
		expect(
			isPageDoneMessage(
				messageEvent( ORIGIN, { type: 'other' } ),
				ORIGIN
			)
		).toBe( false );
		expect(
			isPageDoneMessage( messageEvent( ORIGIN, null ), ORIGIN )
		).toBe( false );
		expect(
			isPageDoneMessage( messageEvent( ORIGIN, 'nope' ), ORIGIN )
		).toBe( false );
	} );
} );

describe( 'nextPageIndex', () => {
	it( 'advances to the next index', () => {
		expect( nextPageIndex( 0 ) ).toBe( 1 );
		expect( nextPageIndex( 1 ) ).toBe( 2 );
	} );

	it( 'keeps incrementing past any bound — the server wraps, not the client', () => {
		expect( nextPageIndex( 4 ) ).toBe( 5 );
		expect( nextPageIndex( 999 ) ).toBe( 1000 );
	} );
} );
