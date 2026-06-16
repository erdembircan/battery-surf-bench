import { runCLI } from '@wp-playground/cli';
import type { BlueprintDeclaration } from '@wp-playground/blueprints';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYGROUND_READY_MARKER, PLUGIN_VFS_PATH } from './config.mts';
import { logServerReady } from './log-server.mts';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const pluginDir = resolve( __dirname, '..' );

interface StartTestServerOptions {
	port: number;
	url: string;
	blueprint: BlueprintDeclaration;
}

/**
 * Poll a playground URL until it returns a non-error response.
 *
 * runCLI() resolves after the worker pool is populated, but there is a brief
 * window during startup where the HTTP server is listening while the initial
 * PHP worker is still bootstrapping (it answers with 5xx). This probe ensures
 * the server can handle a real request before signalling readiness.
 *
 * @param url             - The URL to poll.
 * @param options         - Polling options.
 * @param options.retries - Maximum number of attempts.
 * @param options.delayMs - Milliseconds between attempts.
 */
async function waitForReady(
	url: string,
	{ retries = 40, delayMs = 1000 } = {}
): Promise< void > {
	for ( let attempt = 1; attempt <= retries; attempt++ ) {
		try {
			const res = await fetch( url, { redirect: 'manual' } );
			if ( res.status < 500 ) {
				return;
			}
		} catch {
			// Connection refused or similar -- server not ready.
		}
		await new Promise( ( r ) => setTimeout( r, delayMs ) );
	}
	throw new Error(
		`Playground did not become ready after ${ retries } attempts`
	);
}

/**
 * Start a non-persistent WordPress Playground test server.
 *
 * Nothing is written to disk. The plugin directory is mounted into the virtual
 * filesystem so it can be tested without side effects. Once the server can
 * handle requests, a stdout marker is emitted so Playwright's
 * `webServer.wait.stdout` can detect readiness.
 *
 * @param options           - Server options.
 * @param options.port      - Port to listen on.
 * @param options.url       - Base URL for readiness polling.
 * @param options.blueprint - Blueprint declaration to apply.
 */
export async function startTestServer( {
	port,
	url,
	blueprint,
}: StartTestServerOptions ): Promise< void > {
	const server = await runCLI( {
		command: 'server',
		port,
		blueprint,
		mount: [ { hostPath: pluginDir, vfsPath: PLUGIN_VFS_PATH } ],
	} );

	await waitForReady( url );

	logServerReady( {
		url: String( server.serverUrl ),
		mode: 'non-persistent',
	} );

	// Signal readiness to Playwright (matched via webServer.wait.stdout).
	process.stdout.write( `${ PLAYGROUND_READY_MARKER }\n` );
}
