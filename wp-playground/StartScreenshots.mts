import { screenshotsBlueprint } from './blueprint.mts';
import {
	PLAYGROUND_SCREENSHOTS_PORT,
	PLAYGROUND_SCREENSHOTS_READY_MARKER,
	playgroundTestUrl,
} from './config.mts';
import { resolveOpenPort } from './ResolveOpenPort.mts';
import { startTestServer } from './start-test-server.mts';

/**
 * Starts the non-persistent Playground server the listing-screenshot run
 * captures from; `pnpm screenshots` boots it through Playwright's
 * `webServer`. It serves {@link screenshotsBlueprint} on the first free port
 * from {@link PLAYGROUND_SCREENSHOTS_PORT} up, and announces readiness with
 * {@link PLAYGROUND_SCREENSHOTS_READY_MARKER} so Playwright can capture the
 * bound port.
 */
const port = await resolveOpenPort( PLAYGROUND_SCREENSHOTS_PORT );

await startTestServer( {
	port,
	url: playgroundTestUrl( port ),
	blueprint: screenshotsBlueprint,
	readyMarker: PLAYGROUND_SCREENSHOTS_READY_MARKER,
} );
