/**
 * The toast slice of the cockpit store: the single bottom notification pill and
 * its lifecycle. Reads the current toast off the reactive context (kind, text,
 * phase) and binds the pill's visibility, variant and animation classes; drives
 * the enter → hold → leave transitions from the pill's `animationend`; and owns
 * the two triggers — dismissing by hand, and raising the view-only notice when
 * the pointer enters the running viewport (once per run). The queue and timers
 * live in the per-instance state; the queue logic itself is in {@link ./Toasts}.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/StoreParts';
import { instanceFor } from '@/cockpit/RunInstance';
import { enqueueToast, finishToast, TOAST_HOLD_MS } from '@/cockpit/Toasts';

/**
 * Begins the leave animation for the showing toast, cancelling its pending hold
 * so a hand dismissal and the hold timer cannot both fire.
 *
 * @param context  The reactive cockpit context the pill binds to.
 * @param instance The per-instance state holding the hold timer.
 */
const startLeave = (
	context: CockpitContext,
	instance: ReturnType< typeof instanceFor >
): void => {
	if ( instance.toastTimer !== null ) {
		clearTimeout( instance.toastTimer );
		instance.toastTimer = null;
	}
	context.toastPhase = 'leaving';
};

/** The toast slice of the `bsb/cockpit` store. */
export const toastStore: StorePart = {
	state: {
		/** Whether a toast is on screen — drives the pill's visibility. */
		get hasToast(): boolean {
			return getContext< CockpitContext >().toastKind !== '';
		},

		/** Whether the showing toast is the upload-error variant. */
		get isToastError(): boolean {
			return getContext< CockpitContext >().toastKind === 'error';
		},

		/** Whether the showing toast is the view-only notice variant. */
		get isToastNotice(): boolean {
			return getContext< CockpitContext >().toastKind === 'notice';
		},

		/** The showing toast's message. */
		get toastMessage(): string {
			return getContext< CockpitContext >().toastText;
		},

		/** ARIA live role: assertive for an error, polite for a notice. */
		get toastRole(): string {
			return getContext< CockpitContext >().toastKind === 'error'
				? 'alert'
				: 'status';
		},

		/** Whether the pill is playing its enter animation. */
		get isToastEntering(): boolean {
			return getContext< CockpitContext >().toastPhase === 'entering';
		},

		/** Whether the pill is resting on screen. */
		get isToastHolding(): boolean {
			return getContext< CockpitContext >().toastPhase === 'holding';
		},

		/** Whether the pill is playing its leave animation. */
		get isToastLeaving(): boolean {
			return getContext< CockpitContext >().toastPhase === 'leaving';
		},
	},
	actions: {
		/** Dismisses the showing toast early; the next queued one follows. */
		dismissToast(): void {
			startLeave( getContext< CockpitContext >(), instanceFor() );
		},

		/**
		 * Raises the view-only notice when the pointer enters the viewport during
		 * a run — but only once per run, so cursor movement cannot machine-gun the
		 * toast. Bound to `pointerenter` (never `mousemove`); a fresh run re-arms
		 * it. A no-op at rest, since the viewport is only shown mid-run.
		 */
		viewportEnter(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			if ( ! context.running || instance.noticeShownThisRun ) {
				return;
			}

			instance.noticeShownThisRun = true;
			enqueueToast( context, instance, 'notice' );
		},
	},
	callbacks: {
		/**
		 * Advances the pill's lifecycle on each animation end. After the enter
		 * animation the toast rests and a hold timer is armed to leave on its own;
		 * after the leave animation the toast is cleared and the next queued one is
		 * pumped. Bound with `data-wp-on--animationend` on the pill.
		 */
		onToastAnimationEnd(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			if ( context.toastPhase === 'entering' ) {
				context.toastPhase = 'holding';
				instance.toastTimer = setTimeout( () => {
					instance.toastTimer = null;
					context.toastPhase = 'leaving';
				}, TOAST_HOLD_MS ) as unknown as number;
				return;
			}

			if ( context.toastPhase === 'leaving' ) {
				finishToast( context, instance );
			}
		},
	},
};
