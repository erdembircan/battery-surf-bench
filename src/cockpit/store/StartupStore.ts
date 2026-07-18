/**
 * The startup slice of the cockpit store: the session-start postcard and the
 * control-deck reveal it drives. The postcard's picture front stands alone at
 * rest; flipping it to the "how it works" back slides the deck in. The deck is
 * also revealed once a run is live (it carries the readouts pill).
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/store/StoreParts';

/** The startup slice of the `bsb/cockpit` store. */
export const startupStore: StorePart = {
	state: {
		/**
		 * Whether the startup postcard is turned to its written "how it works"
		 * back. Drives both the card's flip and the deck reveal (the two are
		 * coupled before a run: flipping to the back slides the deck in).
		 */
		get isIdleFlipped(): boolean {
			return getContext< CockpitContext >().idleFlipped;
		},

		/**
		 * Whether the control deck is slid into view. The deck is hidden by
		 * default (the stylesheet's base state), so at session start the postcard
		 * stands alone with no hydration flash; this reveal class is added once a
		 * run is live (the deck carries the readouts pill) or the startup card is
		 * flipped to its back. When the Battery Status API is unsupported the deck
		 * stays away even when the card is flipped to the warning — there is no run
		 * to configure.
		 */
		get isDeckShown(): boolean {
			const { running, idleFlipped, batterySupported } =
				getContext< CockpitContext >();

			return running || ( idleFlipped && batterySupported );
		},
	},
	actions: {
		/**
		 * Turns the startup postcard between its picture front and its written
		 * "how it works" back. Coupled to the deck reveal: the back is shown with
		 * the control deck slid in, the front with the deck tucked away.
		 */
		toggleIdleFlip(): void {
			const context = getContext< CockpitContext >();
			context.idleFlipped = ! context.idleFlipped;
		},
	},
};
