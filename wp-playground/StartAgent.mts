import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	agentEndpoint,
	agentMcpConfig,
	agentReadyText,
	type AgentCredentials,
} from './AgentConnection.mts';
import { agentBlueprint } from './blueprint.mts';
import {
	AGENT_CREDENTIALS_DIR,
	AGENT_CREDENTIALS_VFS_PATH,
	PLAYGROUND_AGENT_PORT,
	playgroundTestUrl,
} from './config.mts';
import { resolveOpenPort } from './ResolveOpenPort.mts';
import { startTestServer } from './start-test-server.mts';

/**
 * Starts the agent playground: a fresh, non-persistent Playground site for
 * trying the plugin's AI agent abilities (`composer serve:agent`). It serves
 * {@link agentBlueprint} on the first free port from
 * {@link PLAYGROUND_AGENT_PORT} up, with the MCP Adapter, seeded benchmark runs
 * and pages, and an application password. The seed writes that password's
 * credentials into the mounted {@link AGENT_CREDENTIALS_DIR}; once the site is
 * ready this reads them back, prints how to connect, and writes the same
 * connection to `mcp.json` beside them. Stop the server with Ctrl+C.
 */
const credentialsFile = join( AGENT_CREDENTIALS_DIR, 'credentials.json' );

mkdirSync( AGENT_CREDENTIALS_DIR, { recursive: true } );
// A stale file from an earlier run would hand out a password this fresh site
// never created.
rmSync( credentialsFile, { force: true } );

const port = await resolveOpenPort( PLAYGROUND_AGENT_PORT );
const url = playgroundTestUrl( port );

await startTestServer( {
	port,
	url,
	blueprint: agentBlueprint,
	extraMounts: [
		{
			hostPath: AGENT_CREDENTIALS_DIR,
			vfsPath: AGENT_CREDENTIALS_VFS_PATH,
		},
	],
} );

const credentials = JSON.parse(
	readFileSync( credentialsFile, 'utf8' )
) as AgentCredentials;
const endpoint = agentEndpoint( url );

writeFileSync(
	join( AGENT_CREDENTIALS_DIR, 'mcp.json' ),
	agentMcpConfig( endpoint, credentials )
);
process.stdout.write( agentReadyText( endpoint, credentials ) );
