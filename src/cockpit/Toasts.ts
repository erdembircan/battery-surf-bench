/**
 * The cockpit's toast model — the queue and lifecycle behind the single,
 * bottom-anchored notification pill. Two kinds share one sequential queue: an
 * `error` (a session upload failed, otherwise silent) and a `notice` (the
 * viewport is view-only while a run drives it). Only one toast shows at a time;
 * the next is pumped when the current one finishes leaving.
 *
 * This module owns the data, not the animation: it writes the current toast and
 * its phase onto the reactive context (so the bound pill renders and the CSS
 * plays the enter/leave animation) and holds the pending queue off-context in
 * the per-instance state. The store slice ({@link ./store/ToastStore}) drives the
 * phase transitions from the pill's `animationend`. Keeping the queue logic here
 * — pure over an injected context and queue — lets it be unit-tested without the
 * Interactivity runtime or the DOM.
 */

import { type CockpitContext, type ToastKind } from '@/cockpit/CockpitContext';
import { type InstanceState } from '@/cockpit/RunInstance';

/**
 * How long a toast rests on screen, in milliseconds, before it leaves on its
 * own. The user can dismiss it sooner.
 */
export const TOAST_HOLD_MS = 10000;

/**
 * A first-in, first-out queue of pending toast kinds. Trivial by design — the
 * sequencing and animation live in the store; this just holds what is waiting.
 */
export class ToastQueue {
	/** Pending toast kinds, oldest first. */
	private readonly kinds: ToastKind[] = [];

	/**
	 * Adds a toast kind to the back of the queue.
	 * @param kind The toast kind to enqueue.
	 */
	enqueue( kind: ToastKind ): void {
		this.kinds.push( kind );
	}

	/**
	 * Removes and returns the next pending toast kind, or null when none remain.
	 * @return The next toast kind, or null when the queue is empty.
	 */
	next(): ToastKind | null {
		return this.kinds.shift() ?? null;
	}

	/** How many toasts are waiting behind the one on screen. */
	get size(): number {
		return this.kinds.length;
	}

	/** Discards every pending toast. */
	clear(): void {
		this.kinds.length = 0;
	}
}

/**
 * Shows the next queued toast when the pill is free. A no-op while a toast is
 * already on screen (`toastKind` set) — the store calls this again once that one
 * leaves. The shown toast's text is resolved from the translated strings the
 * server seeded, and its phase is set to `entering` so the pill animates in.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the pending queue.
 */
const pumpToast = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	if ( context.toastKind !== '' ) {
		return;
	}

	const kind = instance.toasts.next();
	if ( ! kind ) {
		return;
	}

	context.toastKind = kind;
	context.toastText = context.toastStrings[ kind ] ?? '';
	context.toastPhase = 'entering';
};

/**
 * Queues a toast and shows it if the pill is free. The single entry point both
 * triggers use — the failed-upload error and the view-only notice.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the pending queue.
 * @param kind     The toast kind to show.
 */
export const enqueueToast = (
	context: CockpitContext,
	instance: InstanceState,
	kind: ToastKind
): void => {
	instance.toasts.enqueue( kind );
	pumpToast( context, instance );
};

/**
 * Clears the toast that just left and pumps the next one. Called by the store
 * when the leave animation ends.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the pending queue.
 */
export const finishToast = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	context.toastKind = '';
	context.toastText = '';
	context.toastPhase = '';
	pumpToast( context, instance );
};
