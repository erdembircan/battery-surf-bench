/**
 * The bark slice of the cockpit store: the playful pill shown over the top of
 * the running viewport whenever the surf engine starts a novelty behavior.
 * Reads the bark currently showing off the reactive context (behavior key,
 * text, phase) and binds the pill's visibility, icon selector and animation
 * classes; listens for the surf engine's behavior-start handshake and raises a
 * bark while a run is live; and drives the enter → hold → leave transitions
 * from the pill's `animationend`. The pending slot and timers live in the
 * per-instance state; the lifecycle itself is in {@link ./Barks}.
 *
 * No actions — barks are decorative and non-interactive, with no dismiss.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from './CockpitContext';
import { type StorePart } from './StoreParts';
import { instanceFor } from './RunInstance';
import { raiseBark, finishBark, BARK_HOLD_MS } from './Barks';
import { isBehaviorStartMessage, behaviorKeyOf } from './BehaviorStart';

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

		/** Whether the pill is playing its enter animation. */
		get isBarkEntering(): boolean {
			return getContext< CockpitContext >().barkPhase === 'entering';
		},

		/** Whether the pill is resting on screen. */
		get isBarkHolding(): boolean {
			return getContext< CockpitContext >().barkPhase === 'holding';
		},

		/** Whether the pill is playing its leave animation. */
		get isBarkLeaving(): boolean {
			return getContext< CockpitContext >().barkPhase === 'leaving';
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

				raiseBark( context, instanceFor(), behaviorKeyOf( event ) );
			};

			window.addEventListener( 'message', onMessage );

			return () => window.removeEventListener( 'message', onMessage );
		},

		/**
		 * Advances the pill's lifecycle on each animation end. After the enter
		 * animation the bark rests and a hold timer is armed to leave on its own;
		 * after the leave animation the bark is cleared and any pending one is
		 * pumped in. Bound with `data-wp-on--animationend` on the pill.
		 */
		onBarkAnimationEnd(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			if ( context.barkPhase === 'entering' ) {
				context.barkPhase = 'holding';
				instance.barkTimer = setTimeout( () => {
					instance.barkTimer = null;
					context.barkPhase = 'leaving';
				}, BARK_HOLD_MS ) as unknown as number;
				return;
			}

			if ( context.barkPhase === 'leaving' ) {
				finishBark( context, instance );
			}
		},
	},
};
