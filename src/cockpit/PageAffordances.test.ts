import { describe, it, expect } from 'vitest';
import {
	isPageAffordancesMessage,
	affordancesOf,
	PAGE_AFFORDANCES_TYPE,
} from './PageAffordances';

const ORIGIN = 'https://example.test';

/**
 * Builds a fake `message` event with the given origin and data.
 * @param origin
 * @param data
 */
const messageEvent = ( origin: string, data: unknown ): MessageEvent =>
	( { origin, data } ) as MessageEvent;

const PAYLOAD = { hasVideo: true, imageCount: 3, textDensity: 0.6 };

describe( 'isPageAffordancesMessage', () => {
	it( 'recognizes a same-origin page-affordances message carrying a well-formed payload', () => {
		expect(
			isPageAffordancesMessage(
				messageEvent( ORIGIN, {
					type: PAGE_AFFORDANCES_TYPE,
					affordances: PAYLOAD,
				} ),
				ORIGIN
			)
		).toBe( true );
	} );

	it( 'rejects a message from a different origin', () => {
		expect(
			isPageAffordancesMessage(
				messageEvent( 'https://evil.test', {
					type: PAGE_AFFORDANCES_TYPE,
					affordances: PAYLOAD,
				} ),
				ORIGIN
			)
		).toBe( false );
	} );

	it( 'rejects a same-origin message of a different shape', () => {
		expect(
			isPageAffordancesMessage(
				messageEvent( ORIGIN, { type: 'other', affordances: PAYLOAD } ),
				ORIGIN
			)
		).toBe( false );
		expect(
			isPageAffordancesMessage( messageEvent( ORIGIN, null ), ORIGIN )
		).toBe( false );
	} );

	it.each( [
		{ hasVideo: 'yes', imageCount: 3, textDensity: 0.6 },
		{ hasVideo: true, imageCount: '3', textDensity: 0.6 },
		{ hasVideo: true, imageCount: 3, textDensity: '0.6' },
		{ hasVideo: true, imageCount: 3 },
		null,
		'nope',
	] )( 'rejects a malformed affordances payload (%p)', ( affordances ) => {
		expect(
			isPageAffordancesMessage(
				messageEvent( ORIGIN, {
					type: PAGE_AFFORDANCES_TYPE,
					affordances,
				} ),
				ORIGIN
			)
		).toBe( false );
	} );
} );

describe( 'affordancesOf', () => {
	it( 'reads the affordance payload from a legitimate message', () => {
		expect(
			affordancesOf(
				messageEvent( ORIGIN, {
					type: PAGE_AFFORDANCES_TYPE,
					affordances: PAYLOAD,
				} )
			)
		).toEqual( PAYLOAD );
	} );
} );
