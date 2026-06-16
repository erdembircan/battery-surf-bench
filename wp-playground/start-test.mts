import { e2eBlueprint } from './blueprint.mts';
import { PLAYGROUND_TEST_PORT, PLAYGROUND_TEST_URL } from './config.mts';
import { startTestServer } from './start-test-server.mts';

/**
 * Start a non-persistent WordPress Playground instance for end-to-end testing.
 *
 * Nothing is written to disk. The plugin directory is mounted into the virtual
 * filesystem so specs run against a deterministic, plugin-active site without
 * side effects.
 */
await startTestServer( {
	port: PLAYGROUND_TEST_PORT,
	url: PLAYGROUND_TEST_URL,
	blueprint: e2eBlueprint,
} );
