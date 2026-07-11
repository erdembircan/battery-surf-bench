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
 * Preferred port for the non-persistent, never-authenticated test playground
 * (see `e2eUnauthenticatedBlueprint` in `blueprint.mts`). Resolved the
 * same way as {@link PLAYGROUND_TEST_PORT} — this is a starting point, not a
 * guarantee. Set well clear of {@link PLAYGROUND_TEST_PORT}'s own increment
 * range (9500..9510) so the two test playgrounds' port resolution can never
 * collide with each other.
 */
export const PLAYGROUND_UNAUTH_TEST_PORT = 9600;

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
 * Name of the environment variable Playwright's `webServer.wait.stdout` named
 * capture group populates with the unauthenticated test playground's
 * actually-bound port (see {@link PLAYGROUND_UNAUTH_READY_PATTERN}). Distinct
 * from {@link PLAYGROUND_TEST_PORT_ENV_VAR} on purpose: each of the two
 * concurrent test servers needs its own capture group name, or Playwright's
 * `wait.stdout` matches on either server's ready line would clobber the same
 * `process.env` key and one project would end up dialing the other server's
 * port.
 */
export const PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR =
	'PLAYGROUND_UNAUTH_TEST_PORT';

/**
 * Parse a test playground port captured into the given environment variable.
 *
 * Returns `undefined` when the variable is unset -- true for the orchestrator
 * process's own config evaluation, which runs before the webServer (and thus
 * the capture) exists, but never runs tests itself so has no baseURL to get
 * right. Throws when the variable is set to something that is not a valid TCP
 * port, since a malformed value at that point means something upstream is
 * already broken and continuing would fail silently later.
 *
 * @param value      - The raw environment variable value, or undefined if unset.
 * @param envVarName - The environment variable's name, used only to name it in the thrown error.
 * @return The parsed port number, or undefined if the variable is unset.
 * @throws If the variable is set but is not a valid port number.
 */
export function parsePlaygroundPortEnv(
	value: string | undefined,
	envVarName: string
): number | undefined {
	if ( value === undefined ) {
		return undefined;
	}

	const port = Number( value );
	if ( ! Number.isInteger( port ) || port < 1 || port > 65535 ) {
		throw new Error(
			`Invalid ${ envVarName } value: "${ value }" is not a valid port number.`
		);
	}

	return port;
}

/**
 * Parse the test playground port captured into {@link PLAYGROUND_TEST_PORT_ENV_VAR}.
 *
 * @param value - The raw environment variable value, or undefined if unset.
 * @return The parsed port number, or undefined if the variable is unset.
 * @throws If the variable is set but is not a valid port number.
 */
export function parsePlaygroundTestPortEnv(
	value: string | undefined
): number | undefined {
	return parsePlaygroundPortEnv( value, PLAYGROUND_TEST_PORT_ENV_VAR );
}

/**
 * Parse the unauthenticated test playground port captured into
 * {@link PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR}.
 *
 * @param value - The raw environment variable value, or undefined if unset.
 * @return The parsed port number, or undefined if the variable is unset.
 * @throws If the variable is set but is not a valid port number.
 */
export function parsePlaygroundUnauthTestPortEnv(
	value: string | undefined
): number | undefined {
	return parsePlaygroundPortEnv( value, PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR );
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
 * Marker written to stdout once the unauthenticated test playground (see
 * `e2eUnauthenticatedBlueprint` in `blueprint.mts`) is fully initialised
 * and can handle HTTP requests. Distinct string from
 * {@link PLAYGROUND_READY_MARKER} so Playwright's `webServer.wait.stdout` for
 * one server's config entry can never match the other server's ready line.
 */
export const PLAYGROUND_UNAUTH_READY_MARKER = '[playground:unauth] ready';

/**
 * Build the stdout line a test server emits once it can handle requests.
 *
 * Carries the bound port alongside the given marker so
 * {@link playgroundReadyPattern}'s named capture group can report it back to
 * Playwright -- see {@link PLAYGROUND_TEST_PORT_ENV_VAR} for why that
 * round-trip is how the two independently-reloaded processes agree on the
 * port at all.
 *
 * @param port   - The port the test playground is listening on.
 * @param marker - The ready marker to embed; defaults to {@link PLAYGROUND_READY_MARKER}.
 * @return The ready-marker stdout line for that port.
 */
export function playgroundReadyLine(
	port: number,
	marker: string = PLAYGROUND_READY_MARKER
): string {
	return `${ marker } (port ${ port })`;
}

/**
 * Build the regex matching a {@link playgroundReadyLine} for a given marker,
 * capturing the bound port into a named group keyed by `portEnvVar`. Each test
 * server needs a distinct env-var name: Playwright writes the captured group
 * into `process.env[portEnvVar]`, so two servers sharing a name would clobber
 * each other's port and send a project to the wrong baseURL.
 *
 * @param marker     - The ready marker the pattern must match.
 * @param portEnvVar - Name of the named capture group the bound port is read back under.
 * @return The regex matching that marker's ready line.
 */
export function playgroundReadyPattern(
	marker: string,
	portEnvVar: string
): RegExp {
	return new RegExp(
		`${ marker.replace(
			/[[\]]/g,
			'\\$&'
		) } \\(port (?<${ portEnvVar }>\\d+)\\)`
	);
}

/**
 * Regex matching {@link playgroundReadyLine}'s output for the authenticated
 * test playground. The named capture group -- keyed by
 * {@link PLAYGROUND_TEST_PORT_ENV_VAR} -- is what Playwright's
 * `webServer.wait.stdout` uses to populate `process.env[PLAYGROUND_TEST_PORT_ENV_VAR]`
 * once the marker appears.
 */
export const PLAYGROUND_READY_PATTERN = playgroundReadyPattern(
	PLAYGROUND_READY_MARKER,
	PLAYGROUND_TEST_PORT_ENV_VAR
);

/**
 * Regex matching {@link playgroundReadyLine}'s output for the unauthenticated
 * test playground. The named capture group -- keyed by
 * {@link PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR} -- is what Playwright's
 * `webServer.wait.stdout` uses to populate `process.env[PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR]`
 * once the marker appears.
 */
export const PLAYGROUND_UNAUTH_READY_PATTERN = playgroundReadyPattern(
	PLAYGROUND_UNAUTH_READY_MARKER,
	PLAYGROUND_UNAUTH_TEST_PORT_ENV_VAR
);

/** File the authenticated admin session is persisted to by the e2e setup project. */
export const ADMIN_STORAGE_STATE = 'test-results/.auth/admin.json';
