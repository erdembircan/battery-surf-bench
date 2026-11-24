/**
 * Tests for what the agent playground prints and writes so a person can
 * connect an MCP client to it.
 */

import { describe, it, expect } from 'vitest';
import {
	agentEndpoint,
	agentMcpConfig,
	agentReadyText,
	basicAuthToken,
} from './AgentConnection.mts';

const credentials = { username: 'admin', password: 'abcd EFGH 1234 ijkl' };

describe( 'agentEndpoint', () => {
	it( 'is the MCP Adapter default server on the site', () => {
		expect( agentEndpoint( 'http://127.0.0.1:9900' ) ).toBe(
			'http://127.0.0.1:9900/wp-json/mcp/mcp-adapter-default-server'
		);
	} );
} );

describe( 'basicAuthToken', () => {
	it( 'is the base64 of username:password, spaces of the application password included', () => {
		expect(
			Buffer.from( basicAuthToken( credentials ), 'base64' ).toString()
		).toBe( 'admin:abcd EFGH 1234 ijkl' );
	} );
} );

describe( 'agentReadyText', () => {
	const endpoint =
		'http://127.0.0.1:9900/wp-json/mcp/mcp-adapter-default-server';
	const basic = basicAuthToken( credentials );

	it( 'prints the connection block', () => {
		expect( agentReadyText( endpoint, credentials ) ).toBe( `
  Agent playground: 24 seeded benchmark runs, a few pages to try in the course, and the MCP Adapter.
  It starts fresh every time, so anything an agent changes is gone on the next start.

  MCP endpoint:          ${ endpoint }
  Username:              admin
  Application password:  abcd EFGH 1234 ijkl

  Connect Claude Code:
    claude mcp add --transport http battery-surf-bench ${ endpoint } --header "Authorization: Basic ${ basic }"

  Or point any MCP client at wp-playground/.agent/mcp.json.
` );
	} );
} );

describe( 'agentMcpConfig', () => {
	it( 'names one HTTP server at the endpoint, authorised with the credentials', () => {
		const endpoint =
			'http://127.0.0.1:9900/wp-json/mcp/mcp-adapter-default-server';

		expect( JSON.parse( agentMcpConfig( endpoint, credentials ) ) ).toEqual(
			{
				mcpServers: {
					'battery-surf-bench': {
						type: 'http',
						url: endpoint,
						headers: {
							Authorization: `Basic ${ basicAuthToken(
								credentials
							) }`,
						},
					},
				},
			}
		);
	} );

	it( 'ends with a newline', () => {
		expect(
			agentMcpConfig( 'http://x', credentials ).endsWith( '\n' )
		).toBe( true );
	} );
} );
