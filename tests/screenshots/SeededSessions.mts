/**
 * The five past sessions the listing screenshots show on the Sessions screen
 * and in the session postcard.
 *
 * Each one is a simulated run fed through the cockpit's own run model,
 * `RunSession`: a battery reading at the battery monitor's 30-second
 * heartbeat and at every 1 % step, on a jittered staircase at the run's drain
 * rate. The model computes the drain rates, the projected full-battery
 * runtime and the sample log, as it does in the cockpit. `toSessionBody` then
 * shapes the REST body a finished run uploads. It mirrors
 * `buildSessionPayload` in `src/cockpit/SessionUpload.ts`, which Node can't
 * import here because that module loads the Interactivity API's browser-only
 * runtime; `SeededSessions.test.mts` holds the two to the same output.
 */

import { RunSession } from '../../src/cockpit/RunSession.ts';
import { parseUserAgent } from '../../src/cockpit/UserAgent.ts';
import { mulberry32 } from '../../src/surfer/Rng.ts';
import type { RunEndReason } from '../../src/cockpit/CockpitContext.ts';
import type { RunMode } from '../../src/cockpit/RunConfig.ts';
import type {
	SessionPayload,
	SessionUploadInput,
} from '../../src/cockpit/SessionUpload.ts';

/** The battery monitor's heartbeat cadence, in milliseconds. */
const HEARTBEAT_MS = 30_000;

export const CHROME_MACOS_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

export const EDGE_WINDOWS_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0';

export const CHROME_LINUX_UA =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

export interface SimulatedRun {
	startedAt: string;
	config: {
		mode: RunMode;
		durationMinutes: number;
		targetPercent: number;
	};
	reason: RunEndReason;
	startLevel: number;
	drainPctPerHour: number;
	/** How long the run lasts; null runs until a target-drop run completes. */
	elapsedSeconds: number | null;
	userAgent: string;
	seed: number;
}

/**
 * Plays a simulated discharge through the cockpit's run model and returns what
 * a finished run would upload. Deterministic: the same run gives the same
 * session every time.
 *
 * @param run - The run to simulate.
 * @return The finished run, as the session upload takes it.
 */
export function simulateRun( run: SimulatedRun ): SessionUploadInput {
	const rng = mulberry32( run.seed );
	const meanMs = 3_600_000 / run.drainPctPerHour;
	const session = new RunSession();
	session.start( 0 );

	const startPct = Math.round( run.startLevel * 100 );
	let pct = startPct;
	let endMs = run.elapsedSeconds === null ? null : run.elapsedSeconds * 1000;
	let nextStepMs = meanMs * ( 0.92 + 0.16 * rng() );
	let nextHeartbeatMs = 0;

	for (;;) {
		const isStep = nextStepMs <= nextHeartbeatMs;
		const t = isStep ? nextStepMs : nextHeartbeatMs;

		if ( endMs !== null && t > endMs ) {
			break;
		}

		if ( isStep ) {
			pct -= 1;
			session.record( t, pct / 100, false );
			nextStepMs += meanMs * ( 0.92 + 0.16 * rng() );

			if (
				endMs === null &&
				startPct - pct >= run.config.targetPercent
			) {
				endMs = t;
				break;
			}
		} else {
			session.record( t, pct / 100, false );
			nextHeartbeatMs += HEARTBEAT_MS;
		}
	}

	const elapsedSeconds = Math.round( ( endMs ?? 0 ) / 1000 );
	const startedAtWall = Date.parse( run.startedAt );
	const endedAtWall = startedAtWall + ( endMs ?? 0 );
	const ua = parseUserAgent( run.userAgent );

	return {
		summary: session.summary(),
		reason: run.reason,
		config: run.config,
		elapsedSeconds,
		samples: session.samples(),
		startedAtWall,
		endedAtWall,
		uaBrowser: ua.browser,
		uaVersion: ua.version,
		uaOs: ua.os,
	};
}

/**
 * Shapes a finished run into the REST body the `bsbench_session` collection
 * accepts. A line-for-line mirror of `buildSessionPayload` in
 * `src/cockpit/SessionUpload.ts`.
 *
 * @param input - The finished run.
 * @return The REST request body, or null when the run logged no samples.
 */
export function toSessionBody(
	input: SessionUploadInput
): SessionPayload | null {
	const { summary } = input;

	if ( ! summary ) {
		return null;
	}

	let status = 'stopped';
	if ( input.reason === 'duration' || input.reason === 'targetDrop' ) {
		status = 'finished';
	} else if ( input.reason === 'plugged' ) {
		status = 'aborted';
	} else if ( input.reason === 'loadError' ) {
		status = 'failed';
	}

	const startedAt = new Date(
		input.startedAtWall ?? input.endedAtWall
	).toISOString();
	const endedAt = new Date( input.endedAtWall ).toISOString();

	const meta: Record< string, unknown > = {
		bsbench_status: status,
		bsbench_mode: input.config.mode === 'duration' ? 'duration' : 'target',
		bsbench_started_at: startedAt,
		bsbench_ended_at: endedAt,
		bsbench_start_level: summary.startLevel,
		bsbench_end_level: summary.endLevel,
		bsbench_dropped_pct: summary.droppedPct,
		bsbench_elapsed: input.elapsedSeconds,
		bsbench_rate_10: summary.rate10 ?? 0,
		bsbench_rate_session: summary.rateSession ?? 0,
		bsbench_time_to_empty: summary.secondsToEmpty ?? 0,
		bsbench_config_mode: input.config.mode,
		bsbench_ua_browser: input.uaBrowser,
		bsbench_ua_version: input.uaVersion,
		bsbench_ua_os: input.uaOs,
		bsbench_samples: input.samples.map( ( sample ) => ( {
			t: sample.t,
			level: sample.level,
			charging: sample.charging,
			count: sample.count,
		} ) ),
	};

	if ( input.config.mode === 'targetDrop' ) {
		meta.bsbench_config_target_percent = input.config.targetPercent;
	} else {
		meta.bsbench_config_duration = input.config.durationMinutes * 60;
	}

	return { status: 'publish', meta };
}

export const LISTING_SESSIONS: readonly SimulatedRun[] = [
	{
		startedAt: '2026-10-26T18:42:00.000Z',
		config: { mode: 'duration', durationMinutes: 60, targetPercent: 10 },
		reason: 'duration',
		startLevel: 0.96,
		drainPctPerHour: 11.6,
		elapsedSeconds: 3600,
		userAgent: CHROME_MACOS_UA,
		seed: 11,
	},
	{
		startedAt: '2026-10-28T13:05:00.000Z',
		config: { mode: 'duration', durationMinutes: 30, targetPercent: 10 },
		reason: 'stopped',
		startLevel: 0.79,
		drainPctPerHour: 13.4,
		elapsedSeconds: 1290,
		userAgent: EDGE_WINDOWS_UA,
		seed: 23,
	},
	{
		startedAt: '2026-10-30T09:20:00.000Z',
		config: { mode: 'targetDrop', durationMinutes: 30, targetPercent: 10 },
		reason: 'targetDrop',
		startLevel: 0.88,
		drainPctPerHour: 14.8,
		elapsedSeconds: null,
		userAgent: CHROME_LINUX_UA,
		seed: 37,
	},
	{
		startedAt: '2026-11-01T17:30:00.000Z',
		config: { mode: 'duration', durationMinutes: 120, targetPercent: 10 },
		reason: 'duration',
		startLevel: 0.99,
		drainPctPerHour: 12.7,
		elapsedSeconds: 7200,
		userAgent: CHROME_MACOS_UA,
		seed: 41,
	},
	{
		startedAt: '2026-11-02T20:10:00.000Z',
		config: { mode: 'duration', durationMinutes: 60, targetPercent: 10 },
		reason: 'plugged',
		startLevel: 0.71,
		drainPctPerHour: 12.2,
		elapsedSeconds: 1020,
		userAgent: CHROME_MACOS_UA,
		seed: 53,
	},
];

/** Index in {@link LISTING_SESSIONS} of the 2-hour run `screenshot-2.png` opens. */
export const POSTCARD_SESSION_INDEX = 3;
