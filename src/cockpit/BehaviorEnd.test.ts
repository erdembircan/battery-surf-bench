import { describe, it, expect } from 'vitest';
import {
	isBehaviorEndMessage,
	behaviorEndKeyOf,
	BEHAVIOR_END_TYPE,
} from '@/cockpit/BehaviorEnd';

const ORIGIN = 'https://example.test';

/**
 * Builds a fake `message` event with the given origin and data.
 * @param origin
 * @param data
 */
const messageEvent = ( origin: string, data: unknown ): MessageEvent =>
	( { origin, data } ) as MessageEvent;

describe( 'isBehaviorEndMessage', () => {
	it( 'recognizes a same-origin behavior-end message', () => {
		expect(
			isBehaviorEndMessage(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_END_TYPE,
					key: 'readPause',
				} ),
				ORIGIN
			)
		).toBe( true );
	} );

	it( 'rejects a message from a different origin', () => {
		expect(
			isBehaviorEndMessage(
				messageEvent( 'https://evil.test', {
					type: BEHAVIOR_END_TYPE,
					key: 'readPause',
				} ),
				ORIGIN
			)
		).toBe( false );
	} );

	it( 'rejects a same-origin message of a different shape', () => {
		expect(
			isBehaviorEndMessage(
				messageEvent( ORIGIN, { type: 'other' } ),
				ORIGIN
			)
		).toBe( false );
		expect(
			isBehaviorEndMessage( messageEvent( ORIGIN, null ), ORIGIN )
		).toBe( false );
		expect(
			isBehaviorEndMessage( messageEvent( ORIGIN, 'nope' ), ORIGIN )
		).toBe( false );
	} );
} );

describe( 'behaviorEndKeyOf', () => {
	it( 'reads the behavior key from a legitimate message', () => {
		expect(
			behaviorEndKeyOf(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_END_TYPE,
					key: 'lingerImage',
				} )
			)
		).toBe( 'lingerImage' );
	} );

	it( 'returns an empty string when the key is missing, blank, or not a string', () => {
		expect(
			behaviorEndKeyOf(
				messageEvent( ORIGIN, { type: BEHAVIOR_END_TYPE } )
			)
		).toBe( '' );
		expect(
			behaviorEndKeyOf(
				messageEvent( ORIGIN, { type: BEHAVIOR_END_TYPE, key: '' } )
			)
		).toBe( '' );
		expect(
			behaviorEndKeyOf(
				messageEvent( ORIGIN, { type: BEHAVIOR_END_TYPE, key: 42 } )
			)
		).toBe( '' );
		expect( behaviorEndKeyOf( messageEvent( ORIGIN, null ) ) ).toBe( '' );
	} );
} );
