import { runCLI } from '@wp-playground/cli';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { devBlueprint, devResumeBlueprint } from './blueprint.mts';
import { PLAYGROUND_DEV_PORT, PLUGIN_VFS_PATH } from './config.mts';
import { logServerReady } from './log-server.mts';

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
const isExistingSite = ! isEmpty && existsSync( resolve( wpDir, 'wp-config.php' ) );

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
const server = await runCLI( {
	command: 'server',
	port: PLAYGROUND_DEV_PORT,
	phpmyadmin: '/phpmyadmin',
	blueprint: isExistingSite ? devResumeBlueprint : devBlueprint,
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
