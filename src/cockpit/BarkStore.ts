/**
 * The bark slice of the cockpit store: the playful pill shown over the top of
 * the running viewport whenever the surf engine starts a novelty behavior.
 * Reads the bark currently showing off the reactive context (behavior key,
 * text, duration, phase) and binds the pill's visibility, icon selector,
 * ebbing-tide animation-duration and animation classes; listens for the surf
 * engine's behavior-start handshake and raises a bark while a run is live.
 *
 * Store-authoritative: every phase transition is driven by the store's own
 * duration/leave timers (owned by {@link ./Barks}) or by a fresh incoming
 * message — never by the pill's own CSS animation finishing. The per-instance
 * timers live in the per-instance state; the lifecycle itself is in
 * {@link ./Barks}.
 *
 * No actions — barks are decorative and non-interactive, with no dismiss.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from './CockpitContext';
import { type StorePart } from './StoreParts';
import { instanceFor } from './RunInstance';
import { raiseBark } from './Barks';
import {
	isBehaviorStartMessage,
	behaviorKeyOf,
	durationOf,
} from './BehaviorStart';

/** The bark slice of the `bsb/cockpit` store. */
export const barkStore: StorePart = {
	state: {
		/** Whether a bark is on screen — drives the pill's visibility. */
		get hasBark(): boolean {
			return getContext< CockpitContext >().barkBehavior !== '';
		},

		/**
		 * The showing bark's behavior key, bound onto the `data-bark` attribute
		 * so the stylesheet selects its icon.
		 */
		get barkKey(): string {
			return getContext< CockpitContext >().barkBehavior;
		},

		/** The showing bark's message. */
		get barkMessage(): string {
			return getContext< CockpitContext >().barkText;
		},

		/** Whether the pill is on screen and counting down (not yet leaving). */
		get isBarkEntering(): boolean {
			return getContext< CockpitContext >().barkPhase === 'entering';
		},

		/** Whether the pill is playing its leave animation. */
		get isBarkLeaving(): boolean {
			return getContext< CockpitContext >().barkPhase === 'leaving';
		},

		/**
		 * The showing bark's full duration as a CSS time value, so the
		 * ebbing-tide fill's `animation-duration` (set via the `--bark-dur`
		 * custom property) matches the behavior's actual wall-clock dwell.
		 * Purely decorative — the store's own duration timer independently
		 * owns the actual dismiss timing; both are fed the same duration so
		 * they finish together.
		 */
		get barkDurationCss(): string {
			return `${ getContext< CockpitContext >().barkDurationMs }ms`;
		},
	},
	callbacks: {
		/**
		 * Listens for the surf engine's behavior-start handshake and raises a
		 * bark while a run is live. The listener stays attached for the block's
		 * lifetime and no-ops while idle (checked per message, not toggled with
		 * `running`), same as {@see RunStore.initPageAdvance}.
		 *
		 * @return A cleanup that detaches the listener.
		 */
		initBark(): () => void {
			const context = getContext< CockpitContext >();

			const onMessage = ( event: MessageEvent ): void => {
				if (
					! context.running ||
					! isBehaviorStartMessage( event, window.location.origin )
				) {
					return;
				}

				raiseBark(
					context,
					instanceFor(),
					behaviorKeyOf( event ),
					durationOf( event )
				);
			};

			window.addEventListener( 'message', onMessage );

			return () => window.removeEventListener( 'message', onMessage );
		},
	},
};
