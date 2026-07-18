/**
 * Tests for run-configuration normalization.
 *
 * These normalizers are the client-side guard against tampered config: whatever
 * a crafted context supplies, the value that reaches the calculations must sit
 * within the supported range and grid. The tests assert clamping, snapping and
 * fallbacks for each field.
 */

import { describe, it, expect } from 'vitest';
import {
	normalizeDuration,
	normalizeSpeed,
	normalizeMode,
	DURATION_MIN,
	DURATION_MAX,
} from '@/cockpit/RunConfig';

describe( 'normalizeDuration', () => {
	it( 'clamps below the minimum and above the maximum', () => {
		expect( normalizeDuration( 0 ) ).toBe( DURATION_MIN );
		expect( normalizeDuration( -50 ) ).toBe( DURATION_MIN );
		expect( normalizeDuration( 300 ) ).toBe( DURATION_MAX );
	} );

	it( 'snaps to the nearest five minutes, both directions', () => {
		expect( normalizeDuration( 24 ) ).toBe( 25 );
		expect( normalizeDuration( 23 ) ).toBe( 25 );
		expect( normalizeDuration( 22 ) ).toBe( 20 );
		expect( normalizeDuration( 6 ) ).toBe( 5 );
	} );

	it( 'leaves a valid in-grid value unchanged', () => {
		expect( normalizeDuration( 30 ) ).toBe( 30 );
		expect( normalizeDuration( 240 ) ).toBe( 240 );
	} );

	it( 'falls back to the minimum for a non-finite value', () => {
		// A non-finite (tampered) value resolves to the shortest run, never a
		// longer one — the conservative choice.
		expect( normalizeDuration( Number.NaN ) ).toBe( DURATION_MIN );
		expect( normalizeDuration( Number.POSITIVE_INFINITY ) ).toBe(
			DURATION_MIN
		);
	} );
} );

describe( 'normalizeSpeed', () => {
	it( 'keeps a supported speed', () => {
		expect( normalizeSpeed( 1 ) ).toBe( 1 );
		expect( normalizeSpeed( 4 ) ).toBe( 4 );
		expect( normalizeSpeed( 10 ) ).toBe( 10 );
	} );

	it( 'falls back to the slowest for an unsupported speed', () => {
		expect( normalizeSpeed( 7 ) ).toBe( 1 );
		expect( normalizeSpeed( 0 ) ).toBe( 1 );
		expect( normalizeSpeed( Number.NaN ) ).toBe( 1 );
	} );
} );

describe( 'normalizeMode', () => {
	it( 'keeps a known mode', () => {
		expect( normalizeMode( 'duration' ) ).toBe( 'duration' );
		expect( normalizeMode( 'targetDrop' ) ).toBe( 'targetDrop' );
	} );

	it( 'falls back to duration for anything unrecognized', () => {
		expect( normalizeMode( 'nonsense' ) ).toBe( 'duration' );
		expect( normalizeMode( undefined ) ).toBe( 'duration' );
		expect( normalizeMode( 42 ) ).toBe( 'duration' );
	} );
} );
