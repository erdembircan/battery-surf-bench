/**
 * The cockpit's run lifecycle helpers — the shared seam between the run, battery
 * and summary slices of the store. Owns the single place a run is torn down
 * ({@link stopRun}) and the readout/summary freezing it depends on, so every
 * cause of a run ending (the stop control, plugging in, the duration elapsing)
 * funnels through one path.
 */

import { type CockpitContext, type RunEndReason } from './CockpitContext';
import { type InstanceState, wallNow } from './RunInstance';
import { RunSession } from './RunSession';
import { buildGraph, type GraphViewport, type GraphModel } from './DrainGraph';
import { buildSessionPayload, postSession } from './SessionUpload';

/**
 * The summary drain graph's drawing viewport (SVG user units). A wide, short
 * aspect so the chart fills the card's width yet stays short enough to leave room
 * for the stat tiles below it within the card's fixed aspect ratio.
 */
export const GRAPH_VIEWPORT: GraphViewport = {
	width: 480,
	height: 90,
	padLeft: 30,
	padRight: 10,
	padTop: 8,
	padBottom: 18,
};

/**
 * The summary chart geometry for a session, or null when nothing to plot.
 *
 * @param session The run session to plot.
 * @return The drain-graph draw model, or null when there is nothing to draw.
 */
const graphFor = ( session: RunSession ): GraphModel | null =>
	buildGraph(
		session.samples(),
		session.readouts().secondsToEmpty,
		GRAPH_VIEWPORT
	);

/**
 * Mirrors the session's derived readouts onto the reactive context.
 *
 * @param context The reactive cockpit context to write the readouts onto.
 * @param session The run session to read the derived readouts from.
 */
export const applyReadouts = (
	context: CockpitContext,
	session: RunSession
): void => {
	const readouts = session.readouts();
	context.rate10 = readouts.rate10;
	context.rateSession = readouts.rateSession;
	context.secondsToEmpty = readouts.secondsToEmpty;
};

/**
 * Freezes the run's summary onto the context: the rate readouts, the start and
 * end battery and drop, and the drain-graph draw model. All land in reactive
 * context (not read live off the non-reactive session log) so the summary
 * renders and re-renders correctly.
 *
 * @param context  The reactive cockpit context to freeze the summary onto.
 * @param instance The per-instance run state holding the session to summarise.
 */
const freezeSummary = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	applyReadouts( context, instance.session );

	const summary = instance.session.summary();
	context.summaryBatteryStart = summary
		? String( Math.round( summary.startLevel * 100 ) )
		: '—';
	context.summaryBatteryEnd = summary
		? String( Math.round( summary.endLevel * 100 ) )
		: '—';
	context.summaryDropped = summary
		? String( Math.round( summary.droppedPct ) )
		: '—';

	const graph = graphFor( instance.session );
	context.hasGraph = graph !== null;
	context.graphJson = graph ? JSON.stringify( graph ) : '';
};

/**
 * Persists the just-ended run to the server (fire-and-forget). Builds the REST
 * payload from the frozen session — the summary, the configuration the run used,
 * its samples, the wall-clock stamps and the user agent — and POSTs it through
 * the session post type's own endpoint. Skipped when the run logged no samples
 * (nothing meaningful to store); any failure is swallowed inside
 * {@link postSession}, so persistence never disturbs the end-of-run UI.
 *
 * @param context  The reactive cockpit context to read the configuration from.
 * @param instance The per-instance run state holding the session and start stamp.
 * @param reason   Why the run ended, mapped to the session's lifecycle status.
 */
const persistSession = (
	context: CockpitContext,
	instance: InstanceState,
	reason: RunEndReason
): void => {
	const payload = buildSessionPayload( {
		summary: instance.session.summary(),
		reason,
		config: {
			mode: context.mode,
			durationMinutes: context.durationMinutes,
			baseline: context.baseline,
			targetPercent: context.targetPercent,
		},
		samples: instance.session.samples(),
		startedAtWall: instance.startedAtWall,
		endedAtWall: wallNow(),
		userAgent: navigator.userAgent,
	} );

	if ( ! payload ) {
		return;
	}

	void postSession( payload );
};

/**
 * Ends a live run, returning the cockpit to its idle, ready state: the run
 * stops and the calculation session is wound up. The single place a run is torn
 * down, whether by the stop control, by plugging in, or by the duration
 * elapsing. It only flips `running`; everything bound to a run reacts to that —
 * the deck returns and the compact pill closes (`isCompact` derives false once
 * `running` is false), and the run clock and battery heartbeat poll stop through
 * the run-activity watch — so each run-scoped effect stays bound to its one cause.
 *
 * Ending also raises the summary: the final readouts are frozen, the run is
 * marked ended with the reason it ended, and the summary card is reset to its
 * picture front. The summary's visibility derives from `ended`, so it appears
 * whatever ended the run.
 *
 * A natural finish — the duration elapsed or the target drop was reached —
 * sounds the finish chime when enabled; a manual stop or a charger interrupt
 * stays silent.
 *
 * Ending also persists the run: the frozen session is uploaded to the server
 * (fire-and-forget) so every cause of a run ending records the session, with no
 * separate save step.
 *
 * @param context  The reactive cockpit context to mark ended.
 * @param instance The per-instance run state to wind up.
 * @param reason   Why the run ended, recorded for the summary's verdict.
 */
export const stopRun = (
	context: CockpitContext,
	instance: InstanceState,
	reason: RunEndReason
): void => {
	freezeSummary( context, instance );
	persistSession( context, instance, reason );
	context.running = false;
	context.ended = true;
	context.endReason = reason;
	context.flipped = false;
	instance.session.stop();

	if (
		context.soundEnabled &&
		( reason === 'duration' || reason === 'targetDrop' )
	) {
		instance.chime?.play();
	}
};
