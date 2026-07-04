import livereload from 'livereload';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	LIVERELOAD_HOST,
	LIVERELOAD_PORT,
	LIVERELOAD_PORT_FILE,
} from './config.mts';
import { MAX_PORT_INCREMENTS } from './ResolveOpenPort.mts';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const pluginDir = resolve( __dirname, '..' );

/** A LiveReload server instance with an `EADDRINUSE`-aware error channel. */
type LiveReloadServer = ReturnType< typeof livereload.createServer >;

/**
 * Attempt to start the LiveReload server on a single port.
 *
 * Unlike a probe-then-bind check, this reports the outcome of the *real* bind:
 * the returned server is the one that will keep running, so there is no window
 * for the port to be taken between a probe and the live server. A port already
 * in use resolves to `null` (the caller increments and retries); any other
 * error rejects so a genuine fault is not mistaken for a busy port.
 *
 * The `error` handler is attached to the LiveReload server itself, not the
 * underlying HTTP server: `livereload` re-emits bind failures on its own
 * instance, and without a listener there that re-emit crashes the process.
 *
 * @param port - The port to bind.
 * @return The listening server, or `null` if the port is in use.
 */
function tryListen( port: number ): Promise< LiveReloadServer | null > {
	return new Promise( ( resolvePromise, rejectPromise ) => {
		let settled = false;

		const server = livereload.createServer(
			{
				host: LIVERELOAD_HOST,
				port,
				exts: [ 'php', 'js', 'css' ],
				delay: 300,
			},
			() => {
				if ( ! settled ) {
					settled = true;
					resolvePromise( server );
				}
			}
		);

		server.on( 'error', ( error: NodeJS.ErrnoException ) => {
			if ( settled ) {
				return;
			}
			settled = true;

			if ( error.code === 'EADDRINUSE' ) {
				try {
					server.server?.close();
				} catch {
					// The bind never completed, so there may be nothing to
					// close; ignore and let the caller try the next port.
				}
				resolvePromise( null );
				return;
			}

			rejectPromise( error );
		} );
	} );
}

/**
 * Start the LiveReload server, incrementing the port when one is in use.
 *
 * Probes `basePort` first; while it is taken (e.g. a watcher from a previous
 * run still holds it) the port is incremented and re-tried, up to
 * `maxIncrements` times. Because the watcher is the process that actually binds
 * the port, it — not the playground start script — owns the resolution: only
 * the binder can guarantee the port is free and report the real one back.
 *
 * @param basePort      - The preferred port to start from.
 * @param maxIncrements - Maximum number of times to increment the port.
 * @return The listening server and the port it bound.
 * @throws If no port in the range is free.
 */
async function startWatcher(
	basePort: number,
	maxIncrements = MAX_PORT_INCREMENTS
): Promise< { server: LiveReloadServer; port: number } > {
	for ( let offset = 0; offset <= maxIncrements; offset++ ) {
		const port = basePort + offset;
		const server = await tryListen( port );

		if ( server ) {
			if ( port !== basePort ) {
				process.stdout.write(
					`[live-reload] port ${ basePort } in use, using ${ port } instead\n`
				);
			}
			return { server, port };
		}
	}

	const lastPort = basePort + maxIncrements;
	throw new Error(
		`[live-reload] no free port found in range ${ basePort }-${ lastPort }; ` +
			`tried ${ maxIncrements + 1 } ports and all were in use.`
	);
}

/**
 * Start a LiveReload server for the Playground dev workflow.
 *
 * Playground has no built-in live reload, and BrowserSync's proxy/snippet modes
 * are incompatible with Playground's auto-login redirect. LiveReload sidesteps
 * both: it serves a client (enqueued into WordPress by the dev blueprint's
 * mu-plugin) that reloads the current page in place when watched files change,
 * so the browser stays on the real Playground URL with its admin session.
 *
 * The server is pinned to `LIVERELOAD_HOST` (the IPv4 loopback) so it binds the
 * same address the mu-plugin's client URL points at; left to its default the
 * `livereload` package binds `localhost`/`::1` and IPv4 requests are refused.
 *
 * The port is resolved dynamically here (see {@link startWatcher}) and the
 * bound port is published to {@link LIVERELOAD_PORT_FILE} so `start.mts` points
 * the dev mu-plugin's client URL at whichever port this run actually used. A
 * stale file from a previous run is cleared first so the playground never reads
 * an outdated port.
 */
rmSync( LIVERELOAD_PORT_FILE, { force: true } );

const { server, port } = await startWatcher( LIVERELOAD_PORT );

writeFileSync( LIVERELOAD_PORT_FILE, String( port ) );

server.watch( [
	resolve( pluginDir, 'build' ),
	resolve( pluginDir, 'includes' ),
	resolve( pluginDir, 'battery-surf-bench.php' ),
] );

process.stdout.write(
	`[live-reload] watching build/, includes/, and the main plugin file on ${ LIVERELOAD_HOST }:${ port }\n`
);
