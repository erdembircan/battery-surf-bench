/**
 * Tests for the user-agent description.
 *
 * These pin the exact labels a stored session carries, across the browsers and
 * platforms a run might be captured on, plus the fallbacks for partial or
 * unrecognised strings.
 */

import { describe, it, expect } from 'vitest';
import { describeUserAgent } from './UserAgent';

describe( 'describeUserAgent', () => {
	it( 'names Chrome and macOS from a desktop Chrome string', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
		expect( describeUserAgent( ua ) ).toBe( 'Chrome 149 · macOS' );
	} );

	it( 'names Chrome and Windows', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
		expect( describeUserAgent( ua ) ).toBe( 'Chrome 120 · Windows' );
	} );

	it( 'distinguishes Edge from the Chrome token it carries', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
		expect( describeUserAgent( ua ) ).toBe( 'Edge 120 · Windows' );
	} );

	it( 'distinguishes Opera from the Chrome token it carries', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';
		expect( describeUserAgent( ua ) ).toBe( 'Opera 106 · Windows' );
	} );

	it( 'names Firefox and Linux', () => {
		const ua =
			'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
		expect( describeUserAgent( ua ) ).toBe( 'Firefox 121 · Linux' );
	} );

	it( 'names Safari and macOS, not the Chrome it does not carry', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
		expect( describeUserAgent( ua ) ).toBe( 'Safari 17 · macOS' );
	} );

	it( 'names mobile Safari and iOS from an iPhone string', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
		expect( describeUserAgent( ua ) ).toBe( 'Safari 17 · iOS' );
	} );

	it( 'names Chrome and Android, not Linux', () => {
		const ua =
			'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
		expect( describeUserAgent( ua ) ).toBe( 'Chrome 120 · Android' );
	} );

	it( 'names Samsung Internet', () => {
		const ua =
			'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';
		expect( describeUserAgent( ua ) ).toBe(
			'Samsung Internet 23 · Android'
		);
	} );

	it( 'names ChromeOS', () => {
		const ua =
			'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
		expect( describeUserAgent( ua ) ).toBe( 'Chrome 120 · ChromeOS' );
	} );

	it( 'falls back to the OS alone when the browser is unrecognised', () => {
		const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SomeBot/1.0';
		expect( describeUserAgent( ua ) ).toBe( 'Windows' );
	} );

	it( 'falls back to the browser alone when the OS is unrecognised', () => {
		const ua = 'Firefox/121.0';
		expect( describeUserAgent( ua ) ).toBe( 'Firefox 121' );
	} );

	it( 'reads Unknown browser for an empty or blank string', () => {
		expect( describeUserAgent( '' ) ).toBe( 'Unknown browser' );
		expect( describeUserAgent( '   ' ) ).toBe( 'Unknown browser' );
	} );

	it( 'reads Unknown browser for an unrecognised string', () => {
		expect( describeUserAgent( 'curl/8.4.0' ) ).toBe( 'Unknown browser' );
	} );
} );
