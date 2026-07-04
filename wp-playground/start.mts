import { runCLI } from '@wp-playground/cli';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
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

/** How long to wait for the watcher to publish its port, in ms. */
const LIVERELOAD_PORT_WAIT_MS = 15_000;

/** How often to re-check for the published port while waiting, in ms. */
const LIVERELOAD_PORT_POLL_MS = 100;

/**
 * Read the LiveReload port the watcher (`live-reload.mts`) bound and published.
 *
 * The watcher owns port resolution: it binds a free port and writes it to
 * {@link LIVERELOAD_PORT_FILE}, so the dev mu-plugin's client URL baked below
 * always matches the port the watcher actually bound. The file is polled
 * because the playground and watcher are separate processes started
 * concurrently, so either may win the race to start.
 *
 * When no watcher is running (e.g. plain `pnpm playground`), the file never
 * appears and the preferred port is used as a harmless fallback — with no
 * watcher behind it the mu-plugin's client script simply 404s, exactly as a
 * hardcoded port would have.
 *
 * @return The resolved LiveReload port.
 */
async function readLiveReloadPort(): Promise< number > {
	const maxAttempts = LIVERELOAD_PORT_WAIT_MS / LIVERELOAD_PORT_POLL_MS;

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
			setTimeout( done, LIVERELOAD_PORT_POLL_MS )
		);
	}

	process.stdout.write(
		`[playground] no LiveReload port published within ${
			LIVERELOAD_PORT_WAIT_MS / 1000
		}s; using ${ LIVERELOAD_PORT }\n`
	);
	return LIVERELOAD_PORT;
}

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

// Read the port the watcher bound so the dev mu-plugin's client URL points at
// it. The watcher owns resolution — it is the process that actually binds the
// port, so it can increment past a busy one and report the real port, which
// this process alone could not guarantee by probing.
const liveReloadPort = await readLiveReloadPort();

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
