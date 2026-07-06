import { describe, it, expect } from 'vitest';
import {
	isBehaviorStartMessage,
	behaviorKeyOf,
	BEHAVIOR_START_TYPE,
} from './BehaviorStart';

const ORIGIN = 'https://example.test';

/**
 * Builds a fake `message` event with the given origin and data.
 * @param origin
 * @param data
 */
const messageEvent = ( origin: string, data: unknown ): MessageEvent =>
	( { origin, data } ) as MessageEvent;

describe( 'isBehaviorStartMessage', () => {
	it( 'recognizes a same-origin behavior-start message', () => {
		expect(
			isBehaviorStartMessage(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: 'readPause',
				} ),
				ORIGIN
			)
		).toBe( true );
	} );

	it( 'rejects a message from a different origin', () => {
		expect(
			isBehaviorStartMessage(
				messageEvent( 'https://evil.test', {
					type: BEHAVIOR_START_TYPE,
				} ),
				ORIGIN
			)
		).toBe( false );
	} );

	it( 'rejects a same-origin message of a different shape', () => {
		expect(
			isBehaviorStartMessage(
				messageEvent( ORIGIN, { type: 'other' } ),
				ORIGIN
			)
		).toBe( false );
		expect(
			isBehaviorStartMessage( messageEvent( ORIGIN, null ), ORIGIN )
		).toBe( false );
		expect(
			isBehaviorStartMessage( messageEvent( ORIGIN, 'nope' ), ORIGIN )
		).toBe( false );
	} );
} );

describe( 'behaviorKeyOf', () => {
	it( 'reads the behavior key from a legitimate message', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: 'lingerImage',
				} )
			)
		).toBe( 'lingerImage' );
	} );

	it( 'returns an empty string when the key is missing', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, { type: BEHAVIOR_START_TYPE } )
			)
		).toBe( '' );
	} );

	it( 'returns an empty string when the key is blank', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, { type: BEHAVIOR_START_TYPE, key: '' } )
			)
		).toBe( '' );
	} );

	it( 'returns an empty string when the key is not a string', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, { type: BEHAVIOR_START_TYPE, key: 42 } )
			)
		).toBe( '' );
	} );

	it( 'returns an empty string for a malformed message', () => {
		expect( behaviorKeyOf( messageEvent( ORIGIN, null ) ) ).toBe( '' );
		expect( behaviorKeyOf( messageEvent( ORIGIN, 'nope' ) ) ).toBe( '' );
	} );
} );
