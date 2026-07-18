/**
 * Tests for the display formatters.
 *
 * These are the exact strings the readout labels show, so the tests pin the
 * formats and the em-dash fallbacks the store relies on.
 */

import { describe, it, expect } from 'vitest';
import {
	formatClock,
	formatTimeToEmpty,
	formatRate,
	durationDigits,
	EM_DASH,
} from '@/cockpit/Format';

describe( 'formatClock', () => {
	it( 'formats seconds as MM:SS, zero-padded', () => {
		expect( formatClock( 0 ) ).toBe( '00:00' );
		expect( formatClock( 75 ) ).toBe( '01:15' );
		expect( formatClock( 1_800 ) ).toBe( '30:00' );
	} );

	it( 'clamps a negative count to zero', () => {
		expect( formatClock( -200 ) ).toBe( '00:00' );
	} );
} );

describe( 'formatTimeToEmpty', () => {
	it( 'formats seconds as H:MM', () => {
		expect( formatTimeToEmpty( 32_040 ) ).toBe( '8:54' );
	} );

	it( 'shows the em dash when there is nothing meaningful', () => {
		expect( formatTimeToEmpty( null ) ).toBe( EM_DASH );
		expect( formatTimeToEmpty( 0 ) ).toBe( EM_DASH );
		expect( formatTimeToEmpty( -10 ) ).toBe( EM_DASH );
		expect( formatTimeToEmpty( Number.POSITIVE_INFINITY ) ).toBe( EM_DASH );
	} );
} );

describe( 'formatRate', () => {
	it( 'shows the number, or the em dash until known', () => {
		expect( formatRate( 7.2 ) ).toBe( '7.2' );
		expect( formatRate( 0 ) ).toBe( '0' );
		expect( formatRate( null ) ).toBe( EM_DASH );
	} );
} );

describe( 'durationDigits', () => {
	it( 'splits a duration into hundreds, tens and units', () => {
		expect( durationDigits( 135 ) ).toEqual( [ 1, 3, 5 ] );
		expect( durationDigits( 30 ) ).toEqual( [ 0, 3, 0 ] );
		expect( durationDigits( 5 ) ).toEqual( [ 0, 0, 5 ] );
	} );
} );
