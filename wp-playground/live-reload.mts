import livereload from 'livereload';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	LIVERELOAD_HOST,
	LIVERELOAD_PORT,
	LIVERELOAD_PORT_FILE,
} from './config.mts';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const pluginDir = resolve( __dirname, '..' );

/** How long to wait for `start.mts` to publish the resolved port, in ms. */
const PORT_WAIT_TIMEOUT_MS = 15_000;

/** How often to re-check for the port file while waiting, in ms. */
const PORT_POLL_INTERVAL_MS = 100;

/**
 * Read the LiveReload port `start.mts` resolved and published, waiting for it
 * to appear.
 *
 * The playground start script owns port resolution: it probes a free port,
 * writes it to {@link LIVERELOAD_PORT_FILE}, and bakes the matching client URL
 * into the dev mu-plugin. This watcher then binds the exact same port so the
 * two processes can never drift. The file is polled because the two dev
 * processes start concurrently and either may win the race.
 *
 * If the file never appears (e.g. the watcher was launched on its own, without
 * the playground), the preferred port is used as a fallback so standalone runs
 * still start rather than hanging.
 *
 * @return The resolved LiveReload port.
 */
async function resolveLiveReloadPort(): Promise< number > {
	const maxAttempts = PORT_WAIT_TIMEOUT_MS / PORT_POLL_INTERVAL_MS;

	for ( let attempt = 0; attempt < maxAttempts; attempt++ ) {
		if ( existsSync( LIVERELOAD_PORT_FILE ) ) {
			const parsed = Number.parseInt(
				readFileSync( LIVERELOAD_PORT_FILE, 'utf8' ).trim(),
				10
			);
			if ( Number.isInteger( parsed ) && parsed > 0 ) {
				return parsed;
			}
		}

		await new Promise( ( done ) =>
			setTimeout( done, PORT_POLL_INTERVAL_MS )
		);
	}

	process.stdout.write(
		`[live-reload] no port published within ${
			PORT_WAIT_TIMEOUT_MS / 1000
		}s; falling back to ${ LIVERELOAD_PORT }\n`
	);
	return LIVERELOAD_PORT;
}

const port = await resolveLiveReloadPort();

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
 * The port is resolved dynamically by `start.mts` (see
 * {@link resolveLiveReloadPort}) so a busy preferred port no longer wedges the
 * dev workflow.
 */
const server = livereload.createServer( {
	host: LIVERELOAD_HOST,
	port,
	exts: [ 'php', 'js', 'css' ],
	delay: 300,
} );

server.watch( [
	resolve( pluginDir, 'build' ),
	resolve( pluginDir, 'includes' ),
	resolve( pluginDir, 'battery-surf-bench.php' ),
] );

process.stdout.write(
	`[live-reload] watching build/, includes/, and the main plugin file on ${ LIVERELOAD_HOST }:${ port }\n`
);
