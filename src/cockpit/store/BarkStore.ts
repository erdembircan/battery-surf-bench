/**
 * The bark slice of the cockpit store: the playful pill shown over the top of
 * the running viewport whenever the surf engine starts a novelty behavior.
 * Reads the bark currently showing off the reactive context (behavior key,
 * text, duration, phase, generation) and binds the pill's visibility, icon
 * selector, ebbing-tide animation-duration/animation-name and animation
 * classes; listens for the surf engine's behavior-start handshake and raises
 * a bark while a run is live.
 *
 * Store-authoritative: every phase transition is driven by the store's own
 * duration/leave timers (owned by {@link ../Barks}) — never by the pill's own
 * CSS animation finishing. A bark arriving while one is already showing
 * queues in the pending slot and begins the showing bark's leave right away
 * — there is no minimum on-screen time — so the outgoing bark always plays
 * its full leave animation before the pending one enters, and barks are
 * shown in order, none dropped. The pending slot and timers live in the
 * per-instance state; the lifecycle itself is in {@link ../Barks}.
 *
 * No actions — barks are decorative and non-interactive, with no dismiss.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/store/StoreParts';
import { instanceFor } from '@/cockpit/RunInstance';
import { raiseBark } from '@/cockpit/Barks';
import {
	isBehaviorStartMessage,
	behaviorKeyOf,
	durationOf,
} from '@/cockpit/BehaviorStart';

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

		/**
		 * Alternates between two byte-identical ebb keyframes by the parity of
		 * `barkGeneration`, which `Barks.ts` advances on every fresh bark. Bound
		 * onto the tide's `animation-name` (via the `--bark-ebb-name` custom
		 * property) so the drain is guaranteed to restart from full on every new
		 * bark — a change in `animation-name`'s computed value is the one
		 * CSS-spec-guaranteed restart trigger, unlike a duration/custom-property
		 * tweak alone, which would not restart two consecutive barks that
		 * happen to share the same key and announced duration (e.g. two
		 * `moveOn` or two `selectSnippet` barks in a row).
		 */
		get barkEbbName(): string {
			return getContext< CockpitContext >().barkGeneration % 2 === 0
				? 'bsb-bark-ebb-a'
				: 'bsb-bark-ebb-b';
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
