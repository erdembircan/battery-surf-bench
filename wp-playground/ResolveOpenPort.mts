import { createServer } from 'node:net';

/** How many times the base port may be incremented before giving up. */
export const MAX_PORT_INCREMENTS = 10;

/**
 * Resolve whether a single TCP port can be bound on the given host.
 *
 * Attempts to listen on the port and reports the outcome rather than throwing:
 * a port already in use (or otherwise unbindable) resolves to `false`, a port
 * that binds cleanly resolves to `true` after the probe server is closed.
 *
 * @param port - The port to probe.
 * @param host - The host/interface to probe the port on.
 * @return Whether the port is free to bind.
 */
function isPortFree( port: number, host: string ): Promise< boolean > {
	return new Promise( ( resolve ) => {
		const probe = createServer();
		probe.once( 'error', () => resolve( false ) );
		probe.once( 'listening', () => {
			probe.close( () => resolve( true ) );
		} );
		probe.listen( port, host );
	} );
}

/**
 * Find a bindable port at or above `basePort`, incrementing on conflict.
 *
 * Probes `basePort` first; while it is in use the port is incremented and
 * re-probed, up to `maxIncrements` times. The first free port is returned. If
 * every candidate in the range is busy the function throws, so a wedged
 * environment fails loudly instead of silently picking the wrong port.
 *
 * @param basePort      - The preferred port to start from.
 * @param host          - The host/interface the port must be free on.
 * @param maxIncrements - Maximum number of times to increment the port.
 * @return The first free port found at or above `basePort`.
 * @throws If no port in the range `basePort`..`basePort + maxIncrements` is free.
 */
export async function resolveOpenPort(
	basePort: number,
	host: string,
	maxIncrements = MAX_PORT_INCREMENTS
): Promise< number > {
	for ( let offset = 0; offset <= maxIncrements; offset++ ) {
		const port = basePort + offset;
		if ( await isPortFree( port, host ) ) {
			return port;
		}
	}

	const lastPort = basePort + maxIncrements;
	throw new Error(
		`No free port found in range ${ basePort }-${ lastPort }; ` +
			`tried ${ maxIncrements + 1 } ports and all were in use.`
	);
}
