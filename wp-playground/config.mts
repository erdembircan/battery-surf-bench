/**
 * Shared configuration for WordPress Playground instances.
 *
 * Centralises port numbers, base URLs, and the plugin mount target so the
 * playground start scripts, LiveReload watcher, and e2e tests reference the
 * same values instead of hardcoding them independently.
 */

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

/** Port the LiveReload server listens on during development. */
export const LIVERELOAD_PORT = 35729;

/** Base URL for the persistent (development) playground. */
export const PLAYGROUND_DEV_URL = `http://${ PLAYGROUND_HOST }:${ PLAYGROUND_DEV_PORT }`;

/** Base URL for the non-persistent (test) playground. */
export const PLAYGROUND_TEST_URL = `http://${ PLAYGROUND_HOST }:${ PLAYGROUND_TEST_PORT }`;

/** URL of the LiveReload client script the dev mu-plugin enqueues. */
export const LIVERELOAD_CLIENT_URL = `http://127.0.0.1:${ LIVERELOAD_PORT }/livereload.js`;

/**
 * Marker written to stdout once the playground is fully initialised and can
 * handle HTTP requests. Playwright's `webServer.wait.stdout` matches this
 * string to avoid a race in `@wp-playground/cli` where the HTTP server starts
 * listening before the PHP worker has finished bootstrapping.
 */
export const PLAYGROUND_READY_MARKER = '[playground] ready';

/** File the authenticated admin session is persisted to by the e2e setup project. */
export const ADMIN_STORAGE_STATE = 'test-results/.auth/admin.json';
