/**
 * What the agent playground tells a person about how to connect to it: the MCP
 * endpoint, the Basic credentials built from the seeded application password,
 * the text printed once the site is ready, and the `mcp.json` an MCP client can
 * be pointed at. Pure functions, so `StartAgent.mts` stays a thin runner.
 */

/** The MCP server name an MCP client files the connection under. */
export const AGENT_MCP_SERVER_NAME = 'battery-surf-bench';

/** The credentials the seed writes for the `admin` user. */
export interface AgentCredentials {
	username: string;
	password: string;
}

/**
 * Build the MCP Adapter's default server endpoint on a site.
 *
 * @param siteUrl - The site's base URL, without a trailing slash.
 * @return The default MCP server's URL.
 */
export function agentEndpoint( siteUrl: string ): string {
	return `${ siteUrl }/wp-json/mcp/mcp-adapter-default-server`;
}

/**
 * Build the Basic authentication token of a set of credentials: the base64 of
 * `username:password`, which an `Authorization: Basic` header carries.
 *
 * @param credentials - The seeded username and application password.
 * @return The base64 token.
 */
export function basicAuthToken( credentials: AgentCredentials ): string {
	return Buffer.from(
		`${ credentials.username }:${ credentials.password }`
	).toString( 'base64' );
}

/**
 * Build the text printed once the agent playground is ready.
 *
 * @param endpoint    - The MCP endpoint.
 * @param credentials - The seeded username and application password.
 * @return The text, ready to write to the terminal.
 */
export function agentReadyText(
	endpoint: string,
	credentials: AgentCredentials
): string {
	const basic = basicAuthToken( credentials );

	return `
  Agent playground: 24 seeded benchmark runs, a few pages to try in the course, and the MCP Adapter.
  It starts fresh every time, so anything an agent changes is gone on the next start.

  MCP endpoint:          ${ endpoint }
  Username:              ${ credentials.username }
  Application password:  ${ credentials.password }

  Connect Claude Code:
    claude mcp add --transport http ${ AGENT_MCP_SERVER_NAME } ${ endpoint } --header "Authorization: Basic ${ basic }"

  Or point any MCP client at wp-playground/.agent/mcp.json.
`;
}

/**
 * Build the `mcp.json` an MCP client can be pointed at.
 *
 * @param endpoint    - The MCP endpoint.
 * @param credentials - The seeded username and application password.
 * @return The file's JSON text.
 */
export function agentMcpConfig(
	endpoint: string,
	credentials: AgentCredentials
): string {
	return `${ JSON.stringify(
		{
			mcpServers: {
				[ AGENT_MCP_SERVER_NAME ]: {
					type: 'http',
					url: endpoint,
					headers: {
						Authorization: `Basic ${ basicAuthToken(
							credentials
						) }`,
					},
				},
			},
		},
		null,
		2
	) }\n`;
}
