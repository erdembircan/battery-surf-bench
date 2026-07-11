import { e2eUnauthenticatedBlueprint } from './blueprint.mts';
import {
	PLAYGROUND_UNAUTH_TEST_PORT,
	PLAYGROUND_UNAUTH_READY_MARKER,
	playgroundTestUrl,
} from './config.mts';
import { resolveOpenPort } from './ResolveOpenPort.mts';
import { startTestServer } from './start-test-server.mts';

/**
 * Start a non-persistent, never-authenticated WordPress Playground instance
 * for end-to-end testing.
 *
 * Mirrors `start-test.mts`, but boots {@link e2eUnauthenticatedBlueprint}
 * instead of `e2eBlueprint`. Neither blueprint carries a `login` step, so
 * nothing here installs Playground's auto-login mu-plugin or ever
 * pre-authenticates the server; what keeps a fresh browser context here
 * genuinely logged out is that no Playwright project targeting this server
 * drives a form login or loads a `storageState` (unlike the `authenticated`
 * project's `auth.setup.mts`). This backs the `unauthenticated` Playwright
 * project, which drives gated admin screens, front-end routes and REST
 * endpoints as an anonymous visitor to prove they are actually refused.
 *
 * Nothing is written to disk, and the plugin directory is mounted the same
 * way the authenticated test server mounts it. The port is always resolved
 * here — incrementing past a busy one — whether this script is launched by
 * Playwright's webServer or run standalone (`pnpm playground:test:unauth`).
 */
const port = await resolveOpenPort( PLAYGROUND_UNAUTH_TEST_PORT );

await startTestServer( {
	port,
	url: playgroundTestUrl( port ),
	blueprint: e2eUnauthenticatedBlueprint,
	readyMarker: PLAYGROUND_UNAUTH_READY_MARKER,
} );
