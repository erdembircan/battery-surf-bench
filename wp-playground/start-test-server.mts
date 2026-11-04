import { runCLI } from '@wp-playground/cli';
import type { BlueprintDeclaration } from '@wp-playground/blueprints';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	playgroundReadyLine,
	PLAYGROUND_READY_MARKER,
	PLUGIN_VFS_PATH,
} from './config.mts';
import { logServerReady } from './log-server.mts';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const repositoryDir = resolve( __dirname, '..' );

interface StartTestServerOptions {
	port: number;
	url: string;
	blueprint: BlueprintDeclaration;
	/** Ready marker to emit on stdout; defaults to {@link PLAYGROUND_READY_MARKER}. */
	readyMarker?: string;
	pluginDir?: string;
}

/**
 * Poll a playground URL until it serves the WordPress login page.
 *
 * runCLI() resolves after the worker pool is populated, but there is a brief
 * window during startup where the HTTP server is listening while the initial
 * PHP worker is still bootstrapping (it answers with 5xx, or a response that
 * is not yet a real served page). Probing `/wp-login.php` for a genuine
 * `< 400` response -- rather than the bare home URL for `< 500` -- proves
 * WordPress itself is actually up and serving pages, not merely that the HTTP
 * server has bound its port, before signalling readiness.
 *
 * @param url             - The `/wp-login.php` URL to poll.
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
			if ( res.status < 400 ) {
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
 * Start a non-persistent WordPress Playground server.
 *
 * Nothing is written to disk. The plugin folder (the repository by default, or
 * a built plugin such as `dist/battery-surf-bench/`) is mounted into the
 * virtual filesystem so it can be tested without side effects. Once the server can
 * handle requests, a stdout marker carrying the bound port is emitted so
 * Playwright's `webServer.wait.stdout` can both detect readiness and capture
 * the port for its own config re-evaluation (see
 * `PLAYGROUND_TEST_PORT_ENV_VAR` in `config.mts`).
 *
 * @param options             - Server options.
 * @param options.port        - Port to listen on.
 * @param options.url         - Base URL for readiness polling.
 * @param options.blueprint   - Blueprint declaration to apply.
 * @param options.readyMarker - Ready marker to emit on stdout; defaults to {@link PLAYGROUND_READY_MARKER}.
 * @param options.pluginDir   - Plugin folder to mount; defaults to the repository root.
 */
export async function startTestServer( {
	port,
	url,
	blueprint,
	readyMarker = PLAYGROUND_READY_MARKER,
	pluginDir = repositoryDir,
}: StartTestServerOptions ): Promise< void > {
	const server = await runCLI( {
		command: 'server',
		port,
		// Pin the PHP worker pool to 6. @wp-playground/cli's file-locking
		// architecture can deadlock with fewer than 6 workers, and its default
		// resolves to `min(6, cpus - 1)` -- which drops to 1 on a 2-CPU CI
		// runner and hangs boot. An explicit count bypasses that CPU cap.
		workers: 6,
		blueprint,
		mount: [ { hostPath: pluginDir, vfsPath: PLUGIN_VFS_PATH } ],
	} );

	await waitForReady( `${ url }/wp-login.php` );

	logServerReady( {
		url: String( server.serverUrl ),
		mode: 'non-persistent',
	} );

	// Signal readiness to Playwright (matched via webServer.wait.stdout), and
	// hand back the bound port via the same line's named capture group.
	process.stdout.write( `${ playgroundReadyLine( port, readyMarker ) }\n` );
}
