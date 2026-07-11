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
 * instead of `e2eBlueprint`: no `login` step runs, so the server never
 * installs Playground's auto-login mu-plugin and a fresh browser context
 * stays genuinely logged out. This backs the `unauthenticated` Playwright
 * project, which drives gated admin screens, front-end routes and REST
 * endpoints as an anonymous visitor to prove they are actually refused —
 * something the single authenticated test server cannot exercise, since its
 * `e2eBlueprint` auto-promotes any cookie-less browser request to admin.
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
