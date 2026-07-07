import { describe, it, expect } from 'vitest';
import { runBlocksExit, confirmExit } from './ExitGuard';

describe( 'runBlocksExit', () => {
	it( 'blocks leaving while a run is active', () => {
		expect( runBlocksExit( { running: true } ) ).toBe( true );
	} );

	it( 'does not block leaving while idle or after a run has ended', () => {
		expect( runBlocksExit( { running: false } ) ).toBe( false );
	} );
} );

describe( 'confirmExit', () => {
	it( 'arms the native leave-confirmation dialog via preventDefault', () => {
		const event = new Event( 'beforeunload', { cancelable: true } );

		confirmExit( event );

		expect( event.defaultPrevented ).toBe( true );
	} );
} );
