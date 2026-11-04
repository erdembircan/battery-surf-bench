import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGIN_DIR } from '../bin/PackageLayout.mts';
import { productionBlueprint } from './blueprint.mts';
import { PLAYGROUND_PRODUCTION_PORT, playgroundTestUrl } from './config.mts';
import { resolveOpenPort } from './ResolveOpenPort.mts';
import { startTestServer } from './start-test-server.mts';

/**
 * Starts the production preview server: a fresh, non-persistent Playground site
 * running the production build from `dist/battery-surf-bench/`, the plugin
 * folder `composer build:production` assembles, instead of the repository.
 * `composer serve:production` builds that folder and then runs this. It serves
 * {@link productionBlueprint} on the first free port from
 * {@link PLAYGROUND_PRODUCTION_PORT} up, and the site signs the browser in as
 * `admin`. Stop the server with Ctrl+C.
 */
const pluginDir = resolve(
	dirname( fileURLToPath( import.meta.url ) ),
	'..',
	PLUGIN_DIR
);

if ( ! existsSync( pluginDir ) ) {
	process.stderr.write(
		`✗ No production build in ${ PLUGIN_DIR }/: run composer serve:production, which builds it first.\n`
	);
	process.exit( 1 );
}

const port = await resolveOpenPort( PLAYGROUND_PRODUCTION_PORT );

await startTestServer( {
	port,
	url: playgroundTestUrl( port ),
	blueprint: productionBlueprint,
	pluginDir,
} );

process.stdout.write(
	'  The site signs you in as admin: open Battery Surf Bench from the admin menu.\n'
);
