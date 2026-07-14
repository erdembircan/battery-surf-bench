/**
 * The cockpit's bark model — the lifecycle behind the playful pill shown over
 * the top of the running viewport whenever the surf engine starts a novelty
 * behavior. Pure over an injected context and instance, unit-testable without
 * the Interactivity runtime (same philosophy as {@link ./Toasts}).
 *
 * Store-authoritative and duration-tied: the pill stays on screen for the
 * FULL wall-clock duration the behavior announces, and a newly arriving bark
 * ALWAYS replaces the one showing immediately, at any phase — there is no
 * safe period, no pending slot, and no gating on an animation finishing. Two
 * store-owned timers drive every transition: one armed for the announced
 * duration (`entering` → `leaving`), and one armed for the fixed leave
 * duration (`leaving` → cleared). This module owns the data (the showing
 * bark rides the reactive context; the timers live in the per-instance
 * state); the DOM's ebbing-tide fill and its CSS keyframes are a pure
 * reactive projection of `barkDurationMs`/`barkPhase` and never feed back
 * into this lifecycle — no `animationend` drives any transition here.
 */

import { type CockpitContext } from './CockpitContext';
import { type InstanceState } from './RunInstance';

/**
 * How long the leave animation takes, in milliseconds — matches the CSS exit
 * keyframe duration, so the store clears the bark exactly as it finishes
 * animating out.
 */
export const BARK_LEAVE_MS = 320;

/**
 * Picks one of a behavior's two flavor variants at random, or an empty string
 * when the key has no entry (a non-barking, mechanical behavior).
 *
 * @param strings Translated bark quips by behavior key, two variants each.
 * @param key     The behavior key that started running.
 * @param rng     Source of randomness in `[0, 1)`; defaults to `Math.random`.
 * @return The chosen quip, or an empty string when the key does not bark.
 */
export const pickBarkText = (
	strings: Record< string, string[] >,
	key: string,
	rng: () => number = Math.random
): string => {
	const variants = strings[ key ];
	if ( ! variants || variants.length === 0 ) {
		return '';
	}

	return variants[ rng() < 0.5 ? 0 : 1 ] ?? variants[ 0 ] ?? '';
};

/**
 * Clears both bark timers on the instance, so neither an old duration timer
 * nor an old leave timer can fire after a replace/clear has already moved the
 * pill on to something else.
 *
 * @param instance The per-instance state holding the bark's timers.
 */
const clearTimers = ( instance: InstanceState ): void => {
	if ( instance.barkDurationTimer !== null ) {
		window.clearTimeout( instance.barkDurationTimer );
		instance.barkDurationTimer = null;
	}
	if ( instance.barkLeaveTimer !== null ) {
		window.clearTimeout( instance.barkLeaveTimer );
		instance.barkLeaveTimer = null;
	}
};

/**
 * Begins the leave animation for the bark currently showing: sets the phase
 * to `leaving` and arms {@link BARK_LEAVE_MS} before the bark is cleared. The
 * ebbing-tide fill has already reached empty by the time this fires (it
 * animates for the same `barkDurationMs` the duration timer was armed for),
 * so the leave is a pure fade/slide-out, not a countdown.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the bark's timers.
 */
const beginLeave = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	context.barkPhase = 'leaving';
	instance.barkLeaveTimer = window.setTimeout( () => {
		instance.barkLeaveTimer = null;
		finishBark( context, instance );
	}, BARK_LEAVE_MS );
};

/**
 * Raises a bark for a behavior start. A no-op when the key has no translated
 * strings (a non-barking, mechanical behavior), or when it repeats the
 * behavior already showing while that bark hasn't started leaving yet.
 * Otherwise replaces the current bark immediately, at any phase: any armed
 * timers are cleared, the new key/text/duration are written onto the context,
 * the phase is set to `entering`, and a duration timer is armed to begin the
 * leave once the announced dwell elapses.
 *
 * @param context    The reactive cockpit context the pill binds to.
 * @param instance   The per-instance state holding the bark's timers.
 * @param key        The behavior key that started running.
 * @param durationMs The full wall-clock duration to hold the bark for, in ms.
 */
export const raiseBark = (
	context: CockpitContext,
	instance: InstanceState,
	key: string,
	durationMs: number
): void => {
	const variants = context.barkStrings[ key ];
	if ( ! variants || variants.length === 0 ) {
		return;
	}

	if ( key === context.barkBehavior && context.barkPhase !== 'leaving' ) {
		return;
	}

	clearTimers( instance );

	context.barkBehavior = key;
	context.barkText = pickBarkText( context.barkStrings, key );
	context.barkDurationMs = durationMs;
	context.barkPhase = 'entering';

	instance.barkDurationTimer = window.setTimeout( () => {
		instance.barkDurationTimer = null;
		beginLeave( context, instance );
	}, durationMs );
};

/**
 * Clears the bark that just finished leaving, resetting the context to its
 * idle shape. Called by the leave timer once {@link BARK_LEAVE_MS} elapses.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the bark's timers.
 */
export const finishBark = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	clearTimers( instance );
	context.barkBehavior = '';
	context.barkText = '';
	context.barkDurationMs = 0;
	context.barkPhase = '';
};

/**
 * Immediately clears everything — the showing bark and every timer. Called
 * when a run stops, so no bark lingers over the idle viewport.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the bark's timers.
 */
export const clearBark = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	clearTimers( instance );
	context.barkBehavior = '';
	context.barkText = '';
	context.barkDurationMs = 0;
	context.barkPhase = '';
};
