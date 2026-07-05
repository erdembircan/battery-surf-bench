/**
 * Tests for the pure helpers in the shared playground configuration.
 *
 * These back the e2e port-collision fix: `playgroundTestUrl()` builds the test
 * playground's base URL from whichever port was actually resolved,
 * `parsePlaygroundTestPortEnv()` reads the port `start-test.mts` reports back
 * to Playwright, and `playgroundReadyLine()`/`PLAYGROUND_READY_PATTERN` are
 * the write and read sides of that report-back round-trip. None of these
 * touch the filesystem or bind a real port, so they're plain unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
	playgroundTestUrl,
	parsePlaygroundTestPortEnv,
	playgroundReadyLine,
	PLAYGROUND_READY_PATTERN,
	PLAYGROUND_TEST_PORT_ENV_VAR,
} from './config.mts';

describe( 'playgroundTestUrl', () => {
	it( 'builds the base URL from the given port', () => {
		expect( playgroundTestUrl( 9500 ) ).toBe( 'http://127.0.0.1:9500' );
	} );

	it( 'reflects a different resolved port', () => {
		expect( playgroundTestUrl( 9501 ) ).toBe( 'http://127.0.0.1:9501' );
	} );
} );

describe( 'parsePlaygroundTestPortEnv', () => {
	it( 'returns undefined when the variable is unset', () => {
		expect( parsePlaygroundTestPortEnv( undefined ) ).toBeUndefined();
	} );

	it( 'parses a valid port string to a number', () => {
		expect( parsePlaygroundTestPortEnv( '9500' ) ).toBe( 9500 );
	} );

	it( 'throws on a non-numeric value', () => {
		expect( () => parsePlaygroundTestPortEnv( 'not-a-port' ) ).toThrow();
	} );

	it( 'throws on a port number out of the valid TCP range', () => {
		expect( () => parsePlaygroundTestPortEnv( '0' ) ).toThrow();
		expect( () => parsePlaygroundTestPortEnv( '70000' ) ).toThrow();
	} );

	it( 'throws on a non-integer numeric value', () => {
		expect( () => parsePlaygroundTestPortEnv( '9500.5' ) ).toThrow();
	} );
} );

describe( 'playgroundReadyLine', () => {
	it( 'embeds the port alongside the ready marker', () => {
		expect( playgroundReadyLine( 9500 ) ).toBe(
			'[playground] ready (port 9500)'
		);
	} );
} );

describe( 'PLAYGROUND_READY_PATTERN', () => {
	it( 'matches a ready line and captures the port under the env var name', () => {
		const match = PLAYGROUND_READY_PATTERN.exec(
			playgroundReadyLine( 9500 )
		);

		expect( match ).not.toBeNull();
		expect( match?.groups?.[ PLAYGROUND_TEST_PORT_ENV_VAR ] ).toBe(
			'9500'
		);
	} );

	it( 'does not match the bare ready marker without a port', () => {
		expect( PLAYGROUND_READY_PATTERN.test( '[playground] ready' ) ).toBe(
			false
		);
	} );

	it( 'matches when the ready line is embedded in surrounding output', () => {
		const output = `some preamble\n${ playgroundReadyLine(
			9501
		) }\nmore output`;

		const match = PLAYGROUND_READY_PATTERN.exec( output );

		expect( match?.groups?.[ PLAYGROUND_TEST_PORT_ENV_VAR ] ).toBe(
			'9501'
		);
	} );
} );
