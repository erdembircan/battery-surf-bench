/**
 * Tests for the user-agent parser.
 *
 * These pin the discrete browser/version/OS fields a stored session keeps,
 * across the browsers and platforms a run might be captured on, plus the
 * empty-field fallbacks for partial or unrecognised strings.
 */

import { describe, it, expect } from 'vitest';
import { parseUserAgent } from './UserAgent';

describe( 'parseUserAgent', () => {
	it( 'parses Chrome and macOS from a desktop Chrome string', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Chrome',
			version: '149',
			os: 'macOS',
		} );
	} );

	it( 'parses Chrome and Windows', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Chrome',
			version: '120',
			os: 'Windows',
		} );
	} );

	it( 'distinguishes Edge from the Chrome token it carries', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Edge',
			version: '120',
			os: 'Windows',
		} );
	} );

	it( 'distinguishes Opera, reporting its own version not the Chrome token', () => {
		const ua =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Opera',
			version: '106',
			os: 'Windows',
		} );
	} );

	it( 'parses Firefox and Linux', () => {
		const ua =
			'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Firefox',
			version: '121',
			os: 'Linux',
		} );
	} );

	it( 'parses Safari and macOS, not the Chrome it does not carry', () => {
		const ua =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Safari',
			version: '17',
			os: 'macOS',
		} );
	} );

	it( 'parses mobile Safari and iOS from an iPhone string', () => {
		const ua =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Safari',
			version: '17',
			os: 'iOS',
		} );
	} );

	it( 'parses Chrome and Android, not Linux', () => {
		const ua =
			'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Chrome',
			version: '120',
			os: 'Android',
		} );
	} );

	it( 'parses Samsung Internet', () => {
		const ua =
			'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Samsung Internet',
			version: '23',
			os: 'Android',
		} );
	} );

	it( 'parses ChromeOS', () => {
		const ua =
			'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: 'Chrome',
			version: '120',
			os: 'ChromeOS',
		} );
	} );

	it( 'leaves the browser fields empty when only the OS is recognised', () => {
		const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SomeBot/1.0';
		expect( parseUserAgent( ua ) ).toEqual( {
			browser: '',
			version: '',
			os: 'Windows',
		} );
	} );

	it( 'leaves the OS empty when only the browser is recognised', () => {
		expect( parseUserAgent( 'Firefox/121.0' ) ).toEqual( {
			browser: 'Firefox',
			version: '121',
			os: '',
		} );
	} );

	it( 'returns all-empty fields for an empty or blank string', () => {
		const empty = { browser: '', version: '', os: '' };
		expect( parseUserAgent( '' ) ).toEqual( empty );
		expect( parseUserAgent( '   ' ) ).toEqual( empty );
	} );

	it( 'returns all-empty fields for an unrecognised string', () => {
		expect( parseUserAgent( 'curl/8.4.0' ) ).toEqual( {
			browser: '',
			version: '',
			os: '',
		} );
	} );
} );
