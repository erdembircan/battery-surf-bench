import { e2eBlueprint } from './blueprint.mts';
import { PLAYGROUND_TEST_PORT, playgroundTestUrl } from './config.mts';
import { resolveOpenPort } from './ResolveOpenPort.mts';
import { startTestServer } from './start-test-server.mts';

/**
 * Start a non-persistent WordPress Playground instance for end-to-end testing.
 *
 * Nothing is written to disk. The plugin directory is mounted into the virtual
 * filesystem so specs run against a deterministic, plugin-active site without
 * side effects.
 *
 * The port is always resolved here -- incrementing past a busy one, the same
 * way the dev playground does -- whether this script is launched by
 * Playwright's webServer or run standalone (`pnpm playground:test`). This is
 * the one process that actually binds the socket, so it is the only one that
 * can resolve it correctly; `playwright.config.mts` learns the chosen port
 * back from this script's ready stdout marker rather than the other way
 * around (see `PLAYGROUND_TEST_PORT_ENV_VAR` in `config.mts`).
 */
const port = await resolveOpenPort( PLAYGROUND_TEST_PORT );

await startTestServer( {
	port,
	url: playgroundTestUrl( port ),
	blueprint: e2eBlueprint,
} );
