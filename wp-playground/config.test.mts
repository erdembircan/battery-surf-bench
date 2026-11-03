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
	parsePlaygroundUnauthTestPortEnv,
	parsePlaygroundScreenshotsPortEnv,
	parsePlaygroundPortEnv,
	playgroundReadyLine,
	playgroundReadyPattern,
	PLAYGROUND_READY_PATTERN,
	PLAYGROUND_READY_MARKER,
	PLAYGROUND_TEST_PORT_ENV_VAR,
	PLAYGROUND_UNAUTH_READY_PATTERN,
	PLAYGROUND_UNAUTH_READY_MARKER,
	PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR,
	PLAYGROUND_SCREENSHOTS_READY_PATTERN,
	PLAYGROUND_SCREENSHOTS_READY_MARKER,
	PLAYGROUND_SCREENSHOTS_PORT_ENV_VAR,
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

describe( 'parsePlaygroundUnauthTestPortEnv', () => {
	it( 'returns undefined when the variable is unset', () => {
		expect( parsePlaygroundUnauthTestPortEnv( undefined ) ).toBeUndefined();
	} );

	it( 'parses a valid port string to a number', () => {
		expect( parsePlaygroundUnauthTestPortEnv( '9600' ) ).toBe( 9600 );
	} );

	it( 'throws on a non-numeric value, naming its own env var in the message', () => {
		expect( () =>
			parsePlaygroundUnauthTestPortEnv( 'not-a-port' )
		).toThrow( /PLAYGROUND_UNAUTH_TEST_PORT/ );
	} );
} );

describe( 'parsePlaygroundScreenshotsPortEnv', () => {
	it( 'returns undefined when the variable is unset', () => {
		expect(
			parsePlaygroundScreenshotsPortEnv( undefined )
		).toBeUndefined();
	} );

	it( 'parses a valid port string to a number', () => {
		expect( parsePlaygroundScreenshotsPortEnv( '9700' ) ).toBe( 9700 );
	} );

	it( 'throws on a non-numeric value, naming its own env var in the message', () => {
		expect( () =>
			parsePlaygroundScreenshotsPortEnv( 'not-a-port' )
		).toThrow( /PLAYGROUND_SCREENSHOTS_PORT/ );
	} );
} );

describe( 'parsePlaygroundPortEnv', () => {
	it( 'returns undefined when the variable is unset', () => {
		expect(
			parsePlaygroundPortEnv( undefined, 'SOME_PORT_VAR' )
		).toBeUndefined();
	} );

	it( 'parses a valid port string to a number', () => {
		expect( parsePlaygroundPortEnv( '9999', 'SOME_PORT_VAR' ) ).toBe(
			9999
		);
	} );

	it( 'throws on an invalid value, naming the given env var in the message', () => {
		expect( () =>
			parsePlaygroundPortEnv( 'nope', 'SOME_PORT_VAR' )
		).toThrow( /SOME_PORT_VAR/ );
	} );

	it( 'throws on a port number out of the valid TCP range', () => {
		expect( () =>
			parsePlaygroundPortEnv( '0', 'SOME_PORT_VAR' )
		).toThrow();
		expect( () =>
			parsePlaygroundPortEnv( '70000', 'SOME_PORT_VAR' )
		).toThrow();
	} );

	it( 'throws on a non-integer numeric value', () => {
		expect( () =>
			parsePlaygroundPortEnv( '9500.5', 'SOME_PORT_VAR' )
		).toThrow();
	} );
} );

describe( 'playgroundReadyLine', () => {
	it( 'embeds the port alongside the default ready marker', () => {
		expect( playgroundReadyLine( 9500 ) ).toBe(
			'[playground] ready (port 9500)'
		);
	} );

	it( 'embeds the port alongside a custom marker', () => {
		expect( playgroundReadyLine( 9600, '[custom] ready' ) ).toBe(
			'[custom] ready (port 9600)'
		);
	} );
} );

describe( 'playgroundReadyPattern', () => {
	it( 'matches a ready line built with the same marker, capturing under the given env-var name', () => {
		const pattern = playgroundReadyPattern(
			'[custom] ready',
			'CUSTOM_PORT_VAR'
		);

		const match = pattern.exec(
			playgroundReadyLine( 9700, '[custom] ready' )
		);

		expect( match ).not.toBeNull();
		expect( match?.groups?.CUSTOM_PORT_VAR ).toBe( '9700' );
	} );

	it( 'does not match a ready line built with a different marker', () => {
		const pattern = playgroundReadyPattern(
			'[custom] ready',
			'CUSTOM_PORT_VAR'
		);

		expect(
			pattern.test( playgroundReadyLine( 9700, '[other] ready' ) )
		).toBe( false );
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

describe( 'PLAYGROUND_UNAUTH_READY_PATTERN', () => {
	it( 'matches an unauth ready line and captures the port under its own env var name', () => {
		const line = playgroundReadyLine(
			9600,
			PLAYGROUND_UNAUTH_READY_MARKER
		);

		const match = PLAYGROUND_UNAUTH_READY_PATTERN.exec( line );

		expect( match ).not.toBeNull();
		expect( match?.groups?.[ PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR ] ).toBe(
			'9600'
		);
	} );

	it( "does not match the authenticated server's ready line", () => {
		expect(
			PLAYGROUND_UNAUTH_READY_PATTERN.test( playgroundReadyLine( 9500 ) )
		).toBe( false );
	} );

	it( 'captures into a different named group than PLAYGROUND_READY_PATTERN, so the two can never collide', () => {
		expect( PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR ).not.toBe(
			PLAYGROUND_TEST_PORT_ENV_VAR
		);

		const authLine = playgroundReadyLine( 9500, PLAYGROUND_READY_MARKER );
		const unauthLine = playgroundReadyLine(
			9600,
			PLAYGROUND_UNAUTH_READY_MARKER
		);

		// Each pattern matches only its own server's line...
		expect( PLAYGROUND_READY_PATTERN.test( authLine ) ).toBe( true );
		expect( PLAYGROUND_UNAUTH_READY_PATTERN.test( unauthLine ) ).toBe(
			true
		);
		// ...and never the other's.
		expect( PLAYGROUND_READY_PATTERN.test( unauthLine ) ).toBe( false );
		expect( PLAYGROUND_UNAUTH_READY_PATTERN.test( authLine ) ).toBe(
			false
		);
	} );
} );

describe( 'PLAYGROUND_SCREENSHOTS_READY_PATTERN', () => {
	it( 'matches a screenshots ready line and captures the port under its own env var name', () => {
		const line = playgroundReadyLine(
			9700,
			PLAYGROUND_SCREENSHOTS_READY_MARKER
		);

		const match = PLAYGROUND_SCREENSHOTS_READY_PATTERN.exec( line );

		expect( match ).not.toBeNull();
		expect( match?.groups?.[ PLAYGROUND_SCREENSHOTS_PORT_ENV_VAR ] ).toBe(
			'9700'
		);
	} );

	it( "does not match the e2e servers' ready lines, nor they its", () => {
		const screenshotsLine = playgroundReadyLine(
			9700,
			PLAYGROUND_SCREENSHOTS_READY_MARKER
		);

		expect(
			PLAYGROUND_SCREENSHOTS_READY_PATTERN.test(
				playgroundReadyLine( 9500 )
			)
		).toBe( false );
		expect(
			PLAYGROUND_SCREENSHOTS_READY_PATTERN.test(
				playgroundReadyLine( 9600, PLAYGROUND_UNAUTH_READY_MARKER )
			)
		).toBe( false );
		expect( PLAYGROUND_READY_PATTERN.test( screenshotsLine ) ).toBe(
			false
		);
		expect( PLAYGROUND_UNAUTH_READY_PATTERN.test( screenshotsLine ) ).toBe(
			false
		);
	} );

	it( 'captures into a different named group than the e2e patterns', () => {
		expect( PLAYGROUND_SCREENSHOTS_PORT_ENV_VAR ).not.toBe(
			PLAYGROUND_TEST_PORT_ENV_VAR
		);
		expect( PLAYGROUND_SCREENSHOTS_PORT_ENV_VAR ).not.toBe(
			PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR
		);
	} );
} );
