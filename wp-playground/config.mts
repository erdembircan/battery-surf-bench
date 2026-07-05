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

/**
 * Preferred port for the non-persistent (test) playground. `start-test.mts`
 * resolves the actual port at startup — incrementing past a busy one, the same
 * way the dev playground and LiveReload watcher do — so this is a starting
 * point, not a guarantee. It is set well clear of {@link PLAYGROUND_DEV_PORT}'s
 * increment range (9400..9410) so a dev playground's own port resolution can
 * never march into the test port's preferred base.
 */
export const PLAYGROUND_TEST_PORT = 9500;

/**
 * Preferred port for the LiveReload server during development. The watcher
 * resolves the actual port at startup — incrementing from this one if it is
 * already taken, mirroring the playground's own port resolution — and publishes
 * it via {@link LIVERELOAD_PORT_FILE}, so this is a starting point, not a
 * guarantee.
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

/**
 * Build the base URL of the non-persistent (test) playground.
 *
 * The port is resolved dynamically by `start-test.mts` rather than baked in,
 * so the base URL is derived from whichever port the test playground actually
 * bound this run.
 *
 * @param port - The port the test playground is listening on.
 * @return The test playground's base URL for that port.
 */
export function playgroundTestUrl( port: number ): string {
	return `http://${ PLAYGROUND_HOST }:${ port }`;
}

/**
 * Name of the environment variable Playwright's `webServer.wait.stdout` named
 * capture group populates with the test playground's actually-bound port (see
 * {@link PLAYGROUND_READY_PATTERN}). `playwright.config.mts` reads it back to
 * build the `baseURL` its worker processes use.
 *
 * A dynamically-resolved port can't be known when `playwright.config.mts` is
 * first evaluated -- only `start-test.mts` (the process that actually binds
 * the socket) can guarantee it. Playwright itself is what reconciles this: its
 * orchestrator process starts the webServer, captures the bound port from its
 * stdout into `process.env`, and *that* environment is what workers inherit
 * when they re-evaluate the config to build their own project options. Two
 * independent config evaluations resolving their own port (rather than one
 * resolving and the other reading this capture) would race and disagree.
 */
export const PLAYGROUND_TEST_PORT_ENV_VAR = 'PLAYGROUND_TEST_PORT';

/**
 * Parse the test playground port captured into {@link PLAYGROUND_TEST_PORT_ENV_VAR}.
 *
 * Returns `undefined` when the variable is unset -- true for the orchestrator
 * process's own config evaluation, which runs before the webServer (and thus
 * the capture) exists, but never runs tests itself so has no baseURL to get
 * right. Throws when the variable is set to something that is not a valid TCP
 * port, since a malformed value at that point means something upstream is
 * already broken and continuing would fail silently later.
 *
 * @param value - The raw environment variable value, or undefined if unset.
 * @return The parsed port number, or undefined if the variable is unset.
 * @throws If the variable is set but is not a valid port number.
 */
export function parsePlaygroundTestPortEnv(
	value: string | undefined
): number | undefined {
	if ( value === undefined ) {
		return undefined;
	}

	const port = Number( value );
	if ( ! Number.isInteger( port ) || port < 1 || port > 65535 ) {
		throw new Error(
			`Invalid ${ PLAYGROUND_TEST_PORT_ENV_VAR } value: "${ value }" is not a valid port number.`
		);
	}

	return port;
}

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
 * processes agree on it. `live-reload.mts` binds a free port (incrementing past
 * a busy one) and writes it here; `start.mts` reads it back to bake the matching
 * client URL into the dev mu-plugin. The watcher owns resolution because only
 * the process that binds the port can guarantee it is free. Regenerated every
 * run and gitignored.
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

/**
 * Build the stdout line `start-test-server.mts` emits once the test
 * playground can handle requests.
 *
 * Carries the bound port alongside {@link PLAYGROUND_READY_MARKER} so
 * {@link PLAYGROUND_READY_PATTERN}'s named capture group can report it back to
 * Playwright -- see {@link PLAYGROUND_TEST_PORT_ENV_VAR} for why that
 * round-trip is how the two independently-reloaded processes agree on the
 * port at all.
 *
 * @param port - The port the test playground is listening on.
 * @return The ready-marker stdout line for that port.
 */
export function playgroundReadyLine( port: number ): string {
	return `${ PLAYGROUND_READY_MARKER } (port ${ port })`;
}

/**
 * Regex matching {@link playgroundReadyLine}'s output. The named capture
 * group -- keyed by {@link PLAYGROUND_TEST_PORT_ENV_VAR} -- is what Playwright's
 * `webServer.wait.stdout` uses to populate `process.env[PLAYGROUND_TEST_PORT_ENV_VAR]`
 * once the marker appears.
 */
export const PLAYGROUND_READY_PATTERN = new RegExp(
	`${ PLAYGROUND_READY_MARKER.replace(
		/[[\]]/g,
		'\\$&'
	) } \\(port (?<${ PLAYGROUND_TEST_PORT_ENV_VAR }>\\d+)\\)`
);

/** File the authenticated admin session is persisted to by the e2e setup project. */
export const ADMIN_STORAGE_STATE = 'test-results/.auth/admin.json';
