/**
 * The cockpit's bark model — the lifecycle behind the playful pill shown over
 * the top of the running viewport whenever the surf engine starts a novelty
 * behavior. Pure over an injected context and instance, unit-testable without
 * the Interactivity runtime (same philosophy as {@link ./Toasts}).
 *
 * Unlike the bottom toast (a FIFO queue, every item eventually shown), a bark
 * has at most one pending replacement: a behavior key with no translated
 * strings never barks, a bark arriving for the key already showing or pending
 * is ignored, and a bark that arrives while the showing one is inside its safe
 * period waits there until the safe period ends — so a fast-firing engine can
 * never flicker through a backlog of quips. This module owns the data (the
 * showing bark rides the reactive context; the pending slot and timers live in
 * the per-instance state); the store slice ({@link ./BarkStore}) drives the
 * phase transitions from the pill's `animationend`.
 */

import { type CockpitContext } from './CockpitContext';
import { type InstanceState } from './RunInstance';

/** How long a bark rests on screen, in milliseconds, once it finishes entering. */
export const BARK_HOLD_MS = 6000;

/**
 * The minimum time a bark must stay on screen before a newer one can replace
 * it. A bark arriving inside this window waits in the pending slot instead of
 * cutting the current one short.
 */
export const BARK_SAFE_MS = 2500;

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
 * Begins the leave animation for the bark currently showing, cancelling its
 * pending hold timer and any pending replace timer so neither can fire after
 * the leave has already started.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the bark's timers.
 */
const startLeave = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	if ( instance.barkTimer !== null ) {
		clearTimeout( instance.barkTimer );
		instance.barkTimer = null;
	}
	if ( instance.barkReplaceTimer !== null ) {
		clearTimeout( instance.barkReplaceTimer );
		instance.barkReplaceTimer = null;
	}
	context.barkPhase = 'leaving';
};

/**
 * Shows a bark for the given behavior key immediately: writes the behavior key
 * and its chosen text onto the context, starts the enter animation, and
 * records when it appeared.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state to record the shown-at stamp onto.
 * @param key      The behavior key to show.
 * @param now      The current time, in milliseconds.
 */
const showBark = (
	context: CockpitContext,
	instance: InstanceState,
	key: string,
	now: number
): void => {
	context.barkBehavior = key;
	context.barkText = pickBarkText( context.barkStrings, key );
	context.barkPhase = 'entering';
	instance.barkShownAt = now;
};

/**
 * Raises a bark for a behavior start. A no-op when the key has no translated
 * strings (a non-barking, mechanical behavior) or already matches the bark
 * showing or pending. Otherwise: shows immediately when the pill is free;
 * replaces the showing bark once its safe period has elapsed; or, inside the
 * safe period, stores the key as pending and arms a timer for the remainder of
 * the safe period, so only the newest arrival survives to replace it.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the pending slot and timers.
 * @param key      The behavior key that started running.
 * @param now      The current time, in milliseconds; defaults to `performance.now()`.
 */
export const raiseBark = (
	context: CockpitContext,
	instance: InstanceState,
	key: string,
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
		showBark( context, instance, key, now );
		return;
	}

	instance.pendingBark = key;

	if ( instance.barkReplaceTimer !== null ) {
		clearTimeout( instance.barkReplaceTimer );
		instance.barkReplaceTimer = null;
	}

	const elapsedSinceShown = now - ( instance.barkShownAt ?? now );
	const remainingSafeMs = BARK_SAFE_MS - elapsedSinceShown;

	if ( remainingSafeMs <= 0 ) {
		startLeave( context, instance );
		return;
	}

	instance.barkReplaceTimer = setTimeout( () => {
		instance.barkReplaceTimer = null;
		startLeave( context, instance );
	}, remainingSafeMs ) as unknown as number;
};

/**
 * Clears the bark that just finished leaving and pumps the pending one (if
 * any), showing it fresh. Called by the store when the leave animation ends.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the pending slot.
 */
export const finishBark = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	context.barkBehavior = '';
	context.barkText = '';
	context.barkPhase = '';

	const pending = instance.pendingBark;
	if ( pending === null ) {
		return;
	}

	instance.pendingBark = null;
	showBark( context, instance, pending, performance.now() );
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
	if ( instance.barkTimer !== null ) {
		clearTimeout( instance.barkTimer );
		instance.barkTimer = null;
	}
	if ( instance.barkReplaceTimer !== null ) {
		clearTimeout( instance.barkReplaceTimer );
		instance.barkReplaceTimer = null;
	}
	instance.pendingBark = null;
	context.barkBehavior = '';
	context.barkText = '';
	context.barkPhase = '';
};
