/**
 * The cockpit's bark model — the lifecycle behind the playful pill shown over
 * the top of the running viewport whenever the surf engine starts a novelty
 * behavior. Pure over an injected context and instance, unit-testable without
 * the Interactivity runtime (same philosophy as {@link ./Toasts}).
 *
 * A store-driven queue, duration-tied: the showing bark holds for the FULL
 * wall-clock duration the behavior announces (not a fixed hold), and — as in
 * the original model — a bark has at most one pending replacement. A behavior
 * key with no translated strings never barks; a bark arriving for the key
 * already showing or pending is ignored; and a bark that arrives while the
 * showing one is inside its safe period ({@link BARK_SAFE_MS}) waits in the
 * pending slot until the safe period ends, so a fast-firing engine can never
 * flicker through a backlog of quips — barks are shown in order, none dropped,
 * none instantly swapped mid-life. Only once the safe period has elapsed does
 * a new arrival begin the showing bark's leave early.
 *
 * Every transition is store-owned — no `animationend` drives any of it. Three
 * timers live on the per-instance state: a **duration timer**, armed for the
 * announced `durationMs`, that begins the leave once the dwell elapses; a
 * **replace timer**, armed for the remainder of the safe period when a
 * pending arrival must wait; and a **leave timer**, armed for
 * {@link BARK_LEAVE_MS}, that clears the bark (and pumps the pending one, if
 * any) once the leave finishes. The DOM's ebbing-tide fill and its CSS
 * keyframes are a pure reactive projection of `barkDurationMs`/`barkPhase`/
 * `barkGeneration` and never feed back into this lifecycle. `barkGeneration`
 * advances on every fresh bark specifically so the drain's `animation-name`
 * (alternated between two identical keyframes by the store's `barkEbbName`
 * getter) is always a genuine change, guaranteeing the drain restarts from
 * full even when two consecutive barks share the same key and duration.
 */

import { type CockpitContext } from './CockpitContext';
import { type InstanceState } from './RunInstance';

/**
 * The minimum time a bark must stay on screen before a newer one can replace
 * it. A bark arriving inside this window waits in the pending slot instead of
 * cutting the current one short.
 */
export const BARK_SAFE_MS = 2500;

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
 * Shows a bark for the given behavior key immediately: writes the behavior
 * key, its chosen text and its announced duration onto the context, starts
 * the enter phase, records when it appeared, arms a duration timer that
 * begins the leave once the announced dwell elapses, and advances
 * `barkGeneration` so the tide's drain animation is guaranteed to restart
 * from full even if this bark shares its key/duration with the one it
 * replaces.
 *
 * @param context    The reactive cockpit context the pill binds to.
 * @param instance   The per-instance state to record the shown-at stamp and
 *                   duration timer onto.
 * @param key        The behavior key to show.
 * @param durationMs The full wall-clock duration to hold the bark for, in ms.
 * @param now        The current time, in milliseconds.
 */
const showBark = (
	context: CockpitContext,
	instance: InstanceState,
	key: string,
	durationMs: number,
	now: number
): void => {
	context.barkBehavior = key;
	context.barkText = pickBarkText( context.barkStrings, key );
	context.barkDurationMs = durationMs;
	context.barkPhase = 'entering';
	context.barkGeneration += 1;
	instance.barkShownAt = now;
	instance.barkDurationTimer = window.setTimeout( () => {
		instance.barkDurationTimer = null;
		beginLeave( context, instance );
	}, durationMs );
};

/**
 * Begins the leave phase for the bark currently showing, cancelling its
 * duration timer and any armed replace timer so neither can fire after the
 * leave has already started. A no-op while already leaving, so a stale
 * duration/replace timer racing in after the leave has begun cannot restart
 * the leave countdown.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the bark's timers.
 */
const beginLeave = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	if ( context.barkPhase === 'leaving' ) {
		return;
	}

	if ( instance.barkDurationTimer !== null ) {
		window.clearTimeout( instance.barkDurationTimer );
		instance.barkDurationTimer = null;
	}
	if ( instance.barkReplaceTimer !== null ) {
		window.clearTimeout( instance.barkReplaceTimer );
		instance.barkReplaceTimer = null;
	}

	context.barkPhase = 'leaving';
	instance.barkLeaveTimer = window.setTimeout( () => {
		instance.barkLeaveTimer = null;
		finishBark( context, instance );
	}, BARK_LEAVE_MS );
};

/**
 * Raises a bark for a behavior start. A no-op when the key has no translated
 * strings (a non-barking, mechanical behavior) or already matches the bark
 * showing or pending. Otherwise: shows immediately when the pill is free;
 * replaces the showing bark once its safe period has elapsed; or, inside the
 * safe period, stores the key and its duration as pending and arms a timer
 * for the remainder of the safe period, so only the newest arrival survives
 * to replace it.
 *
 * @param context    The reactive cockpit context the pill binds to.
 * @param instance   The per-instance state holding the pending slot and
 *                   timers.
 * @param key        The behavior key that started running.
 * @param durationMs The full wall-clock duration to hold the bark for, in ms.
 * @param now        The current time, in milliseconds; defaults to
 *                   `performance.now()`.
 */
export const raiseBark = (
	context: CockpitContext,
	instance: InstanceState,
	key: string,
	durationMs: number,
	now: number = performance.now()
): void => {
	const variants = context.barkStrings[ key ];
	if ( ! variants || variants.length === 0 ) {
		return;
	}

	if ( key === context.barkBehavior || key === instance.pendingBark ) {
		return;
	}

	if ( context.barkBehavior === '' ) {
		showBark( context, instance, key, durationMs, now );
		return;
	}

	instance.pendingBark = key;
	instance.pendingDurationMs = durationMs;

	if ( instance.barkReplaceTimer !== null ) {
		window.clearTimeout( instance.barkReplaceTimer );
		instance.barkReplaceTimer = null;
	}

	const elapsedSinceShown = now - ( instance.barkShownAt ?? now );
	const remainingSafeMs = BARK_SAFE_MS - elapsedSinceShown;

	if ( remainingSafeMs <= 0 ) {
		beginLeave( context, instance );
		return;
	}

	instance.barkReplaceTimer = window.setTimeout( () => {
		instance.barkReplaceTimer = null;
		beginLeave( context, instance );
	}, remainingSafeMs );
};

/**
 * Clears the bark that just finished leaving and pumps the pending one (if
 * any), showing it fresh. Called by the leave timer once
 * {@link BARK_LEAVE_MS} elapses.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the pending slot.
 */
export const finishBark = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	if ( instance.barkLeaveTimer !== null ) {
		window.clearTimeout( instance.barkLeaveTimer );
		instance.barkLeaveTimer = null;
	}

	context.barkBehavior = '';
	context.barkText = '';
	context.barkDurationMs = 0;
	context.barkPhase = '';

	const pendingKey = instance.pendingBark;
	const pendingDurationMs = instance.pendingDurationMs;
	if ( pendingKey === null || pendingDurationMs === null ) {
		return;
	}

	instance.pendingBark = null;
	instance.pendingDurationMs = null;
	showBark(
		context,
		instance,
		pendingKey,
		pendingDurationMs,
		performance.now()
	);
};

/**
 * Immediately clears everything — the showing bark, the pending slot, and
 * every timer. Called when a run stops, so no bark lingers over the idle
 * viewport.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the pending slot and timers.
 */
export const clearBark = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	if ( instance.barkDurationTimer !== null ) {
		window.clearTimeout( instance.barkDurationTimer );
		instance.barkDurationTimer = null;
	}
	if ( instance.barkReplaceTimer !== null ) {
		window.clearTimeout( instance.barkReplaceTimer );
		instance.barkReplaceTimer = null;
	}
	if ( instance.barkLeaveTimer !== null ) {
		window.clearTimeout( instance.barkLeaveTimer );
		instance.barkLeaveTimer = null;
	}
	instance.pendingBark = null;
	instance.pendingDurationMs = null;
	context.barkBehavior = '';
	context.barkText = '';
	context.barkDurationMs = 0;
	context.barkPhase = '';
};
