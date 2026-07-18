/**
 * The cockpit's shark-fin Easter egg model — the swim lifecycle behind the
 * dorsal fin the Konami code releases into the compact topbar's wave strip.
 * Pure over an injected context and instance, unit-testable without the
 * Interactivity runtime (same philosophy as {@link ./Barks}).
 *
 * One shark swims at a time, store-authoritative: `launchShark` plans a swim
 * (a random surfacing point, a random diving point, and the wall-clock
 * duration to cruise between them) and writes it onto the context, then arms
 * a single timer that clears the swim once it — and its CSS trail's longest
 * delay — have finished. The CSS animations bound to the plan are a pure
 * projection and never feed back into this lifecycle; the fin element is
 * `hidden` between swims, so simply un-hiding it is what restarts its
 * animations fresh, and no generation counter is needed the way the bark's
 * ebbing tide needs one.
 */

import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type InstanceState } from '@/cockpit/RunInstance';

/** How long the fin's rise-and-surface animation takes, in milliseconds. */
export const SHARK_SURFACE_MS = 950;

/** How long the fin's dive-under animation takes, in milliseconds. */
export const SHARK_DIVE_MS = 750;

/**
 * How long a full cruise across the entire lane width would take at 1× run
 * speed. An actual swim only crosses part of the lane (from its surfacing
 * point to its diving point), so its actual cruise time is a fraction of
 * this, and faster run speeds shorten it further.
 */
export const SHARK_FULL_CROSS_MS = 15000;

/**
 * The last trail ghost's animation delay (the fifth of five). The clear
 * timer waits this long past the swim's own total duration so the trailing
 * ghost's replay of the swim (surface, cruise and dive alike) has time to
 * finish too.
 */
export const SHARK_TRAIL_MAX_DELAY_MS = 450;

/** A planned swim: where the fin surfaces, where it dives, and how long. */
export interface SwimPlan {
	/** The percentage across the lane the fin surfaces at (left 2–26%). */
	startPct: number;
	/** The percentage across the lane the fin dives under at (right 70–97%). */
	endPct: number;
	/** The swim's full wall-clock duration, in milliseconds. */
	totalMs: number;
}

/**
 * Plans a swim: a random surfacing point in the left part of the lane, a
 * random diving point near the right edge, and the wall-clock duration to
 * cover the distance between them at the run's current speed. The cruise
 * portion scales by the square root of the speed (rather than linearly) so a
 * 10× run visibly churns faster without the fin reading as a torpedo.
 *
 * @param speed The run's demo-speed multiplier.
 * @param rng   Source of randomness in `[0, 1)`; defaults to `Math.random`.
 * @return The planned swim.
 */
export const planSwim = (
	speed: number,
	rng: () => number = Math.random
): SwimPlan => {
	const startPct = 2 + rng() * 24;
	const endPct = 70 + rng() * 27;
	const cruiseMs =
		( ( endPct - startPct ) / 100 ) *
		( SHARK_FULL_CROSS_MS / Math.sqrt( Math.max( 1, speed ) ) );
	const totalMs = Math.round( SHARK_SURFACE_MS + cruiseMs + SHARK_DIVE_MS );

	return { startPct, endPct, totalMs };
};

/**
 * Releases a shark: no-op while one is already swimming (one at a time),
 * otherwise plans a swim, writes it onto the context and arms the timer that
 * clears it once the swim and its trail have both finished.
 *
 * @param context  The reactive cockpit context the fin binds to.
 * @param instance The per-instance state to arm the clear timer onto.
 * @param speed    The run's demo-speed multiplier the swim's cruise scales by.
 * @param rng      Source of randomness in `[0, 1)`; defaults to `Math.random`.
 */
export const launchShark = (
	context: CockpitContext,
	instance: InstanceState,
	speed: number,
	rng: () => number = Math.random
): void => {
	if ( context.sharkSwimming ) {
		return;
	}

	const plan = planSwim( speed, rng );

	context.sharkStartPct = plan.startPct;
	context.sharkEndPct = plan.endPct;
	context.sharkTotalMs = plan.totalMs;
	context.sharkSwimming = true;

	instance.sharkTimer = window.setTimeout( () => {
		instance.sharkTimer = null;
		clearShark( context, instance );
	}, plan.totalMs + SHARK_TRAIL_MAX_DELAY_MS );
};

/**
 * Clears a swim: cancels the clear timer, resets the Konami progress and its
 * last-key timestamp, and takes down every plan field on the context.
 * Idempotent — safe to call whether or not a shark is actually swimming.
 *
 * @param context  The reactive cockpit context the fin binds to.
 * @param instance The per-instance state holding the clear timer and the
 *                 Konami progress.
 */
export const clearShark = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	if ( instance.sharkTimer !== null ) {
		window.clearTimeout( instance.sharkTimer );
		instance.sharkTimer = null;
	}

	instance.konamiProgress = 0;
	instance.konamiLastKeyAt = null;
	context.sharkSwimming = false;
	context.sharkStartPct = 0;
	context.sharkEndPct = 0;
	context.sharkTotalMs = 0;
};
