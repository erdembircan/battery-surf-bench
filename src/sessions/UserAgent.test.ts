/**
 * Tests for the listing's browser display formatter.
 *
 * These pin the exact cell the listing shows from the discrete browser meta a
 * session stores, including the fallbacks when only some fields were captured.
 */

import { describe, it, expect } from 'vitest';
import { formatUserAgent } from '@/sessions/UserAgent';

describe( 'formatUserAgent', () => {
	it( 'composes browser, version and OS', () => {
		expect(
			formatUserAgent( {
				bsbench_ua_browser: 'Chrome',
				bsbench_ua_version: '149',
				bsbench_ua_os: 'macOS',
			} )
		).toBe( 'Chrome 149 · macOS' );
	} );

	it( 'omits the version when absent', () => {
		expect(
			formatUserAgent( {
				bsbench_ua_browser: 'Firefox',
				bsbench_ua_version: '',
				bsbench_ua_os: 'Linux',
			} )
		).toBe( 'Firefox · Linux' );
	} );

	it( 'shows the browser alone when the OS is absent', () => {
		expect(
			formatUserAgent( {
				bsbench_ua_browser: 'Safari',
				bsbench_ua_version: '17',
				bsbench_ua_os: '',
			} )
		).toBe( 'Safari 17' );
	} );

	it( 'shows the OS alone when the browser is absent', () => {
		expect(
			formatUserAgent( {
				bsbench_ua_browser: '',
				bsbench_ua_version: '',
				bsbench_ua_os: 'Windows',
			} )
		).toBe( 'Windows' );
	} );

	it( 'shows an em dash when nothing was captured', () => {
		expect(
			formatUserAgent( {
				bsbench_ua_browser: '',
				bsbench_ua_version: '',
				bsbench_ua_os: '',
			} )
		).toBe( '—' );
	} );

	it( 'shows an em dash when the meta is missing entirely', () => {
		expect( formatUserAgent( {} ) ).toBe( '—' );
	} );
} );
