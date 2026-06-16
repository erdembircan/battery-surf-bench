import livereload from 'livereload';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVERELOAD_PORT } from './config.mts';

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
 */
const server = livereload.createServer( {
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
	`[live-reload] watching build/, includes/, and the main plugin file on port ${ LIVERELOAD_PORT }\n`
);
