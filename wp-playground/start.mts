import { runCLI } from '@wp-playground/cli';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devBlueprint, devResumeBlueprint } from './blueprint.mts';
import {
	LIVERELOAD_PORT,
	LIVERELOAD_PORT_FILE,
	PLAYGROUND_DEV_PORT,
	PLUGIN_VFS_PATH,
} from './config.mts';
import { logServerReady } from './log-server.mts';
import { resolveOpenPort } from './ResolveOpenPort.mts';

// Clear any LiveReload port left over from a previous run before anything else,
// so the live-reload watcher never reads a stale port. It waits for this file
// to reappear with the port this run resolves below.
rmSync( LIVERELOAD_PORT_FILE, { force: true } );

const __dirname = dirname( fileURLToPath( import.meta.url ) );
const pluginDir = resolve( __dirname, '..' );
const wpDir = resolve( __dirname, 'wordpress' );
const shouldReset = process.argv.includes( '--reset' );

// Wipe the existing site when --reset is passed so Playground downloads a
// fresh copy of WordPress.
if ( shouldReset && existsSync( wpDir ) ) {
	rmSync( wpDir, { recursive: true } );
}

// Ensure the wordpress directory exists before mounting. On first run it
// won't exist yet and mount-before-install requires the host path present.
mkdirSync( wpDir, { recursive: true } );

// An empty directory means WordPress hasn't been downloaded yet, so we need
// `download-and-install`. Once files exist we re-use them.
const isEmpty = readdirSync( wpDir ).length === 0;
const isExistingSite =
	! isEmpty && existsSync( resolve( wpDir, 'wp-config.php' ) );

/**
 * Start a persistent WordPress Playground instance.
 *
 * The WordPress installation and database are stored in
 * wp-playground/wordpress/ so data persists between restarts. The plugin
 * directory is mounted before installation to give wp-cli full filesystem
 * access. On first run the dev blueprint logs in as admin, enables debug
 * constants, and activates the plugin; on subsequent runs only login and
 * debug constants are re-applied. phpMyAdmin is available at /phpmyadmin.
 *
 * Pass --reset to wipe the existing site and start fresh.
 */

// Resolve a free port, incrementing from the preferred one if it is taken
// (e.g. a playground from a previous run is still up). Throws after ten
// increments so a wedged machine fails loudly instead of hanging on a port
// that is already in use.
const port = await resolveOpenPort( PLAYGROUND_DEV_PORT );

if ( port !== PLAYGROUND_DEV_PORT ) {
	process.stdout.write(
		`[playground] port ${ PLAYGROUND_DEV_PORT } in use, using ${ port } instead\n`
	);
}

// Resolve a free LiveReload port the same way, then publish it for the
// live-reload watcher (a separate process) to bind. Writing it here — rather
// than letting the watcher pick independently — keeps the mu-plugin's client
// URL and the watcher's bound port in lockstep: an independent pick would
// disagree, since the watcher holds the port and this process's probe would
// then see it as taken.
const liveReloadPort = await resolveOpenPort( LIVERELOAD_PORT );

if ( liveReloadPort !== LIVERELOAD_PORT ) {
	process.stdout.write(
		`[playground] LiveReload port ${ LIVERELOAD_PORT } in use, using ${ liveReloadPort } instead\n`
	);
}

writeFileSync( LIVERELOAD_PORT_FILE, String( liveReloadPort ) );

const server = await runCLI( {
	command: 'server',
	port,
	phpmyadmin: '/phpmyadmin',
	blueprint: isExistingSite
		? devResumeBlueprint( liveReloadPort )
		: devBlueprint( liveReloadPort ),
	'mount-before-install': [
		{ hostPath: wpDir, vfsPath: '/wordpress' },
		{ hostPath: pluginDir, vfsPath: PLUGIN_VFS_PATH },
	],
	wordpressInstallMode: isEmpty
		? 'download-and-install'
		: 'install-from-existing-files-if-needed',
} );

logServerReady( {
	url: String( server.serverUrl ),
	mode: 'persistent',
	phpmyadminPath: '/phpmyadmin',
} );
