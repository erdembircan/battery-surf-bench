/**
 * Shared configuration for WordPress Playground instances.
 *
 * Centralises port numbers, base URLs, and the plugin mount target so the
 * playground start scripts, LiveReload watcher, and e2e tests reference the
 * same values instead of hardcoding them independently.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Host/interface the playground servers bind to and are reached on. */
export const PLAYGROUND_HOST = '127.0.0.1';

/** Plugin slug; also the directory name it is mounted under in the VFS. */
export const PLUGIN_SLUG = 'battery-surf-bench';

/** Virtual filesystem path the plugin directory is mounted to. */
export const PLUGIN_VFS_PATH = `/wordpress/wp-content/plugins/${ PLUGIN_SLUG }`;

/** Port used by the persistent (development) playground. */
export const PLAYGROUND_DEV_PORT = 9400;

/** Port used by the non-persistent (test) playground. */
export const PLAYGROUND_TEST_PORT = 9401;

/**
 * Preferred port for the LiveReload server during development. The actual port
 * is resolved at startup (incrementing from this one if it is already taken,
 * mirroring the playground's own port resolution) and shared between the two
 * dev processes via {@link LIVERELOAD_PORT_FILE}, so this is a starting point,
 * not a guarantee.
 */
export const LIVERELOAD_PORT = 35729;

/**
 * Host the LiveReload server binds to and the dev mu-plugin enqueues the client
 * from. Pinned to the IPv4 loopback because `livereload` defaults its bind host
 * to `localhost`, which resolves to `::1` (IPv6) on macOS — leaving the IPv4
 * `127.0.0.1` the browser requests refused. Both ends derive from this constant
 * so the bind address and the client URL can never drift apart again.
 */
export const LIVERELOAD_HOST = '127.0.0.1';

/** Base URL for the persistent (development) playground. */
export const PLAYGROUND_DEV_URL = `http://${ PLAYGROUND_HOST }:${ PLAYGROUND_DEV_PORT }`;

/** Base URL for the non-persistent (test) playground. */
export const PLAYGROUND_TEST_URL = `http://${ PLAYGROUND_HOST }:${ PLAYGROUND_TEST_PORT }`;

/**
 * Build the URL of the LiveReload client script the dev mu-plugin enqueues.
 *
 * The port is resolved dynamically at startup rather than baked in, so the
 * client URL is derived from whichever port the LiveReload server actually
 * bound this run.
 *
 * @param port - The port the LiveReload server is listening on.
 * @return The `livereload.js` client URL for that port.
 */
export function liveReloadClientUrl( port: number ): string {
	return `http://${ LIVERELOAD_HOST }:${ port }/livereload.js`;
}

/**
 * File the resolved LiveReload port is written to so the two independent dev
 * processes agree on it. `start.mts` resolves a free port, writes it here, and
 * bakes the matching client URL into the dev mu-plugin; `live-reload.mts` reads
 * it back to bind the exact same port. Regenerated every run and gitignored.
 */
export const LIVERELOAD_PORT_FILE = resolve(
	dirname( fileURLToPath( import.meta.url ) ),
	'.livereload-port'
);

/**
 * Marker written to stdout once the playground is fully initialised and can
 * handle HTTP requests. Playwright's `webServer.wait.stdout` matches this
 * string to avoid a race in `@wp-playground/cli` where the HTTP server starts
 * listening before the PHP worker has finished bootstrapping.
 */
export const PLAYGROUND_READY_MARKER = '[playground] ready';

/** File the authenticated admin session is persisted to by the e2e setup project. */
export const ADMIN_STORAGE_STATE = 'test-results/.auth/admin.json';
