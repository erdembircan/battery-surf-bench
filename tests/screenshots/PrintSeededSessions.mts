import {
	LISTING_SESSIONS,
	POSTCARD_SESSION_INDEX,
	simulateRun,
	toSessionBody,
} from './SeededSessions.mts';

/**
 * Prints, as JSON for the capture spec, the five seeded sessions' REST bodies
 * and which of them the postcard screenshot opens.
 *
 * Playwright's loader can't resolve the cockpit modules' `@/` imports, so the
 * spec can't import the run model directly. tsx can, so the spec runs this
 * script and reads its output.
 */
process.stdout.write(
	JSON.stringify( {
		postcardIndex: POSTCARD_SESSION_INDEX,
		bodies: LISTING_SESSIONS.map( ( run ) =>
			toSessionBody( simulateRun( run ) )
		),
	} )
);
