/**
 * Tests for how the test server hands its blueprint to the Playground CLI.
 *
 * The CLI picks the WordPress download from its own `wp` option and never from
 * the blueprint, so the server has to forward the blueprint's WordPress
 * version itself. Without that, a blueprint asking for `beta` would quietly
 * boot the latest release.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCLI } from '@wp-playground/cli';
import type { BlueprintDeclaration } from '@wp-playground/blueprints';
import { startTestServer } from './start-test-server.mts';

vi.mock( '@wp-playground/cli', () => ( {
	runCLI: vi.fn(),
} ) );

vi.mock( './log-server.mts', () => ( {
	logServerReady: vi.fn(),
} ) );

/**
 * Start the test server for a blueprint and return the options the CLI got.
 *
 * @param blueprint - The blueprint to start the server with.
 * @return The options object passed to `runCLI`.
 */
async function startWith( blueprint: BlueprintDeclaration ) {
	await startTestServer( {
		port: 9500,
		url: 'http://127.0.0.1:9500',
		blueprint,
	} );

	return vi.mocked( runCLI ).mock.calls[ 0 ][ 0 ];
}

describe( 'startTestServer', () => {
	beforeEach( () => {
		vi.mocked( runCLI ).mockReset();
		vi.mocked( runCLI ).mockResolvedValue( {
			serverUrl: 'http://127.0.0.1:9500',
		} as unknown as Awaited< ReturnType< typeof runCLI > > );
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue( new Response( null, { status: 200 } ) )
		);
		vi.spyOn( process.stdout, 'write' ).mockReturnValue( true );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	} );

	it( 'boots the WordPress version the blueprint names, such as the beta channel', async () => {
		const options = await startWith( {
			preferredVersions: { php: '8.3', wp: 'beta' },
		} );

		expect( options.wp ).toBe( 'beta' );
	} );

	it( 'boots the latest WordPress when the blueprint names latest', async () => {
		const options = await startWith( {
			preferredVersions: { php: '8.3', wp: 'latest' },
		} );

		expect( options.wp ).toBe( 'latest' );
	} );

	it( 'leaves the WordPress version to the CLI when the blueprint names none', async () => {
		const options = await startWith( {} );

		expect( options.wp ).toBeUndefined();
	} );

	it( 'hands the blueprint itself to the CLI', async () => {
		const blueprint: BlueprintDeclaration = {
			preferredVersions: { php: '8.3', wp: 'beta' },
		};

		const options = await startWith( blueprint );

		expect( options.blueprint ).toBe( blueprint );
	} );
} );
