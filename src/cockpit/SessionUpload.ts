/**
 * Session upload — persists a finished benchmark run to the server.
 *
 * When a run ends (whatever the cause), the cockpit POSTs the whole session —
 * the lifecycle status and run mode, the battery levels, the derived drain
 * statistics, the configuration it ran with, and the run-length-encoded sample
 * log — to the `bsb_session` post type's own REST collection. There is no
 * bespoke controller: the post type is REST-enabled and its meta is registered
 * with REST schemas (see `SessionSchema`), so the native `wp/v2/<post_type>`
 * endpoint accepts the record and validates every meta against its schema.
 *
 * This module is the calculation/transport seam: {@link buildSessionPayload}
 * shapes the REST body from the frozen run and is pure (so it is unit-tested
 * with explicit inputs), and {@link postSession} performs the gated POST. The
 * full collection endpoint URL (assembled server-side, so the client never
 * hard-codes the route) and a `wp_rest` nonce arrive through the Interactivity
 * config the cockpit's PHP route seeds, read with `getConfig()`. A persistence
 * failure is logged and swallowed: a benchmark that
 * ran is shown its summary regardless of whether the upload succeeded.
 */

import { getConfig } from '@wordpress/interactivity';
import { type RunSummary } from './RunSession';
import { type RleSample } from './SampleLog';
import { type RunEndReason } from './CockpitContext';
import { type RunMode } from './RunConfig';

/**
 * The session meta keys, mirroring the prefixed keys `SessionSchema` registers
 * server-side. Kept here as the single client-side list of what a session
 * record carries, so the payload builder reads from one source rather than
 * scattering string literals. The `bsb_` prefix and the `config` group segment
 * match the plugin's meta namespace.
 */
const META = {
	status: 'bsb_status',
	mode: 'bsb_mode',
	startedAt: 'bsb_started_at',
	endedAt: 'bsb_ended_at',
	startLevel: 'bsb_start_level',
	endLevel: 'bsb_end_level',
	droppedPct: 'bsb_dropped_pct',
	elapsed: 'bsb_elapsed',
	rate10: 'bsb_rate_10',
	rateSession: 'bsb_rate_session',
	timeToEmpty: 'bsb_time_to_empty',
	configMode: 'bsb_config_mode',
	configDuration: 'bsb_config_duration',
	configTargetPercent: 'bsb_config_target_percent',
	uaBrowser: 'bsb_ua_browser',
	uaVersion: 'bsb_ua_version',
	uaOs: 'bsb_ua_os',
	surferArchetype: 'bsb_surfer_archetype',
	surferTraits: 'bsb_surfer_traits',
	samples: 'bsb_samples',
} as const;

/** The run configuration persisted with a finished session. */
export interface UploadConfig {
	mode: RunMode;
	durationMinutes: number;
	targetPercent: number;
}

/** Everything {@link buildSessionPayload} needs to assemble the REST body. */
export interface SessionUploadInput {
	/** The frozen end-of-run figures, or null when the run logged no samples. */
	summary: RunSummary | null;
	/** Why the run ended — mapped to the session's lifecycle status. */
	reason: RunEndReason;
	/** The configuration the run was started with. */
	config: UploadConfig;
	/** How long the run actually lasted, in whole seconds. */
	elapsedSeconds: number;
	/** The run-length-encoded sample log. */
	samples: readonly RleSample[];
	/** Wall-clock time (ms since epoch) the run started, or null if unknown. */
	startedAtWall: number | null;
	/** Wall-clock time (ms since epoch) the run ended. */
	endedAtWall: number;
	/** The browser name the run was captured on (empty when unrecognised). */
	uaBrowser: string;
	/** The browser major version (empty when unrecognised). */
	uaVersion: string;
	/** The operating system the run was captured on (empty when unrecognised). */
	uaOs: string;
	/** The surfer trait vector the run was driven with. */
	traits: readonly number[];
	/** The archetype cover-name derived from the trait vector. */
	archetype: string;
}

/** The session record POSTed to the post type's REST collection. */
export interface SessionPayload {
	status: 'publish';
	meta: Record< string, unknown >;
}

/** The REST access details the cockpit's PHP route seeds via `getConfig()`. */
interface RestConfig {
	/** Full session-collection endpoint URL, assembled server-side. */
	restUrl: string;
	/** A `wp_rest` nonce proving the request's intent. */
	restNonce: string;
}

/**
 * Maps how a run ended onto the session's lifecycle status: a natural finish
 * (the duration elapsed or the target drop was reached) is `finished`, a charger
 * interrupt is `aborted`, and a hand stop — or any unrecognised reason — is
 * `stopped`.
 *
 * @param reason Why the run ended.
 * @return The session lifecycle status.
 */
export const statusFor = ( reason: RunEndReason ): string => {
	switch ( reason ) {
		case 'duration':
		case 'targetDrop':
			return 'finished';
		case 'plugged':
			return 'aborted';
		default:
			return 'stopped';
	}
};

/**
 * Maps the run configuration onto the session's top-level mode scalar: the mode
 * follows the timing — `duration` for a fixed length, `target` for a target-drop
 * run. This keeps the listing's mode column populated from the same
 * configuration the run used.
 *
 * @param config The configuration the run was started with.
 * @return The session mode scalar.
 */
export const modeFor = ( config: UploadConfig ): string =>
	config.mode === 'duration' ? 'duration' : 'target';

/**
 * Formats a wall-clock timestamp as an ISO 8601 string for the session's
 * `started_at` / `ended_at` meta.
 *
 * @param ms Milliseconds since the Unix epoch.
 * @return The ISO 8601 timestamp.
 */
const toIso = ( ms: number ): string => new Date( ms ).toISOString();

/**
 * Shapes a finished run into the REST body the `bsb_session` collection accepts:
 * a published status and the full meta record (identity and result scalars, the
 * derived statistics — zero where the run could not compute them, since
 * WordPress REST single meta cannot store a null — the run configuration, the
 * discrete browser fields, and the sample log). Returns null when the run logged
 * no samples,
 * since there is nothing meaningful to persist.
 *
 * No title is sent: a session is identified by its post id in the listing, so
 * the record carries no generated title.
 *
 * @param input The frozen run, its end reason, configuration, samples and stamps.
 * @return The REST request body, or null when there is nothing to persist.
 */
export const buildSessionPayload = (
	input: SessionUploadInput
): SessionPayload | null => {
	const { summary } = input;

	if ( ! summary ) {
		return null;
	}

	const startedAt = toIso( input.startedAtWall ?? input.endedAtWall );
	const endedAt = toIso( input.endedAtWall );

	const meta: Record< string, unknown > = {
		[ META.status ]: statusFor( input.reason ),
		[ META.mode ]: modeFor( input.config ),
		[ META.startedAt ]: startedAt,
		[ META.endedAt ]: endedAt,
		[ META.startLevel ]: summary.startLevel,
		[ META.endLevel ]: summary.endLevel,
		[ META.droppedPct ]: summary.droppedPct,
		[ META.elapsed ]: input.elapsedSeconds,
		// A statistic the run could not compute is stored as zero: WordPress
		// REST single meta cannot hold a null, and zero is no valid reading
		// for these quantities, so it marks the unmeasurable case.
		[ META.rate10 ]: summary.rate10 ?? 0,
		[ META.rateSession ]: summary.rateSession ?? 0,
		[ META.timeToEmpty ]: summary.secondsToEmpty ?? 0,
		[ META.configMode ]: input.config.mode,
		[ META.uaBrowser ]: input.uaBrowser,
		[ META.uaVersion ]: input.uaVersion,
		[ META.uaOs ]: input.uaOs,
		[ META.surferArchetype ]: input.archetype,
		[ META.surferTraits ]: [ ...input.traits ],
		[ META.samples ]: input.samples.map( ( sample ) => ( {
			t: sample.t,
			level: sample.level,
			charging: sample.charging,
			count: sample.count,
		} ) ),
	};

	// Persist only the goal that bounds this run: a target-drop run has no fixed
	// duration, and a duration run has no target. The other
	// stays unset so the listing shows it as not applicable rather than echoing
	// an unused default the run never honoured.
	if ( input.config.mode === 'targetDrop' ) {
		meta[ META.configTargetPercent ] = input.config.targetPercent;
	} else {
		// The cockpit's stepper is in minutes; store the base unit of seconds.
		meta[ META.configDuration ] = input.config.durationMinutes * 60;
	}

	return { status: 'publish', meta };
};

/**
 * POSTs a session record to the post type's REST collection, gated by the
 * `wp_rest` nonce the PHP route minted for the authorized administrator. Returns
 * whether the run was actually persisted, so the caller can surface a failure
 * to the user. A failure is logged and swallowed (never thrown) so it cannot
 * break the end-of-run UI. When the REST config is absent (the route did not
 * seed it) nothing is attempted and `true` is returned — that is a
 * misconfiguration, not a connectivity failure to alarm the user about.
 *
 * @param payload The session record to persist.
 * @return A promise resolving to whether the session was persisted.
 */
export const postSession = async (
	payload: SessionPayload
): Promise< boolean > => {
	const config = getConfig( 'bsb/cockpit' ) as Partial< RestConfig >;

	if ( ! config.restUrl || ! config.restNonce ) {
		return true;
	}

	try {
		const response = await fetch( config.restUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': config.restNonce,
			},
			body: JSON.stringify( payload ),
		} );

		if ( ! response.ok ) {
			// eslint-disable-next-line no-console
			console.error(
				`[bsb] session upload failed: ${ response.status }`
			);
			return false;
		}

		return true;
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error( '[bsb] session upload error', error );
		return false;
	}
};
