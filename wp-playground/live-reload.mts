import livereload from 'livereload';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVERELOAD_HOST, LIVERELOAD_PORT } from './config.mts';

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const pluginDir = resolve( __dirname, '..' );

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
 */
const server = livereload.createServer( {
	host: LIVERELOAD_HOST,
	port: LIVERELOAD_PORT,
	exts: [ 'php', 'js', 'css' ],
	delay: 300,
} );

server.watch( [
	resolve( pluginDir, 'build' ),
	resolve( pluginDir, 'includes' ),
	resolve( pluginDir, 'battery-surf-bench.php' ),
] );

process.stdout.write(
	`[live-reload] watching build/, includes/, and the main plugin file on ${ LIVERELOAD_HOST }:${ LIVERELOAD_PORT }\n`
);
