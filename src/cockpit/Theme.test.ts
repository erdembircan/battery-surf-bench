/**
 * Tests for theme resolution and persistence.
 *
 * The consumer is the store, which resolves a preference to an applied theme,
 * cycles the preference, and remembers it across visits. These tests verify the
 * resolution (including following the OS), the cycle order, and the storage
 * round-trip with a tolerant fallback.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
	resolveTheme,
	nextThemePref,
	readStoredPref,
	writeStoredPref,
	osPrefersDark,
	THEME_KEY,
} from './Theme';

/**
 * Stubs `prefers-color-scheme: dark` to the given match.
 * @param matches
 */
const mockOsDark = ( matches: boolean ): void => {
	( window as { matchMedia?: unknown } ).matchMedia = () => ( { matches } );
};

afterEach( () => {
	delete ( window as { matchMedia?: unknown } ).matchMedia;
	window.localStorage.clear();
} );

describe( 'resolveTheme', () => {
	it( 'applies a fixed preference as-is', () => {
		mockOsDark( true );
		expect( resolveTheme( 'light' ) ).toBe( 'light' );
		expect( resolveTheme( 'dark' ) ).toBe( 'dark' );
	} );

	it( 'follows the OS when on system', () => {
		mockOsDark( true );
		expect( resolveTheme( 'system' ) ).toBe( 'dark' );

		mockOsDark( false );
		expect( resolveTheme( 'system' ) ).toBe( 'light' );
	} );
} );

describe( 'osPrefersDark', () => {
	it( 'reflects the OS scheme, and is false where matchMedia is absent', () => {
		mockOsDark( true );
		expect( osPrefersDark() ).toBe( true );

		delete ( window as { matchMedia?: unknown } ).matchMedia;
		expect( osPrefersDark() ).toBe( false );
	} );
} );

describe( 'nextThemePref', () => {
	it( 'cycles system → light → dark → system', () => {
		expect( nextThemePref( 'system' ) ).toBe( 'light' );
		expect( nextThemePref( 'light' ) ).toBe( 'dark' );
		expect( nextThemePref( 'dark' ) ).toBe( 'system' );
	} );
} );

describe( 'stored preference', () => {
	it( 'round-trips a written preference', () => {
		writeStoredPref( 'dark' );
		expect( window.localStorage.getItem( THEME_KEY ) ).toBe( 'dark' );
		expect( readStoredPref() ).toBe( 'dark' );
	} );

	it( 'defaults to system when nothing is stored', () => {
		expect( readStoredPref() ).toBe( 'system' );
	} );

	it( 'ignores a stored value that is not a known preference', () => {
		window.localStorage.setItem( THEME_KEY, 'rainbow' );
		expect( readStoredPref() ).toBe( 'system' );
	} );
} );
