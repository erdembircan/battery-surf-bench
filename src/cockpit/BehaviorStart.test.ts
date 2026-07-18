import { describe, it, expect } from 'vitest';
import {
	isBehaviorStartMessage,
	behaviorKeyOf,
	durationOf,
	BEHAVIOR_START_TYPE,
} from '@/cockpit/BehaviorStart';

const ORIGIN = 'https://example.test';

/**
 * Builds a fake `message` event with the given origin and data.
 * @param origin
 * @param data
 */
const messageEvent = ( origin: string, data: unknown ): MessageEvent =>
	( { origin, data } ) as MessageEvent;

describe( 'isBehaviorStartMessage', () => {
	it( 'recognizes a same-origin behavior-start message carrying a valid duration', () => {
		expect(
			isBehaviorStartMessage(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: 'readPause',
					durationMs: 8000,
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
					durationMs: 8000,
				} ),
				ORIGIN
			)
		).toBe( false );
	} );

	it( 'rejects a same-origin message of a different shape', () => {
		expect(
			isBehaviorStartMessage(
				messageEvent( ORIGIN, { type: 'other', durationMs: 8000 } ),
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

	it( 'rejects a message missing durationMs', () => {
		expect(
			isBehaviorStartMessage(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: 'readPause',
				} ),
				ORIGIN
			)
		).toBe( false );
	} );

	it.each( [ 0, -100, NaN, Infinity, '8000' ] )(
		'rejects an invalid durationMs (%p)',
		( durationMs ) => {
			expect(
				isBehaviorStartMessage(
					messageEvent( ORIGIN, {
						type: BEHAVIOR_START_TYPE,
						key: 'readPause',
						durationMs,
					} ),
					ORIGIN
				)
			).toBe( false );
		}
	);
} );

describe( 'behaviorKeyOf', () => {
	it( 'reads the behavior key from a legitimate message', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: 'lingerImage',
					durationMs: 2000,
				} )
			)
		).toBe( 'lingerImage' );
	} );

	it( 'returns an empty string when the key is missing', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					durationMs: 2000,
				} )
			)
		).toBe( '' );
	} );

	it( 'returns an empty string when the key is blank', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: '',
					durationMs: 2000,
				} )
			)
		).toBe( '' );
	} );

	it( 'returns an empty string when the key is not a string', () => {
		expect(
			behaviorKeyOf(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: 42,
					durationMs: 2000,
				} )
			)
		).toBe( '' );
	} );

	it( 'returns an empty string for a malformed message', () => {
		expect( behaviorKeyOf( messageEvent( ORIGIN, null ) ) ).toBe( '' );
		expect( behaviorKeyOf( messageEvent( ORIGIN, 'nope' ) ) ).toBe( '' );
	} );
} );

describe( 'durationOf', () => {
	it( 'reads the announced duration from a legitimate message', () => {
		expect(
			durationOf(
				messageEvent( ORIGIN, {
					type: BEHAVIOR_START_TYPE,
					key: 'lingerImage',
					durationMs: 3200,
				} )
			)
		).toBe( 3200 );
	} );
} );
