/**
 * The sound slice of the cockpit store: the finish-chime preference and its
 * toggle. Restores the remembered choice on hydration and builds the chime,
 * delegating audio to {@link ../FinishChime}; a no-op where Web Audio is absent.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/store/StoreParts';
import { instanceFor } from '@/cockpit/RunInstance';
import {
	FinishChime,
	audioContextCtor,
	readStoredSound,
	writeStoredSound,
} from '@/cockpit/FinishChime';

/** The sound slice of the `battery-surf-bench/cockpit` store. */
export const soundStore: StorePart = {
	state: {
		/** Whether the finish chime is enabled — drives the deck's sound toggle. */
		get isSoundOn(): boolean {
			return getContext< CockpitContext >().soundEnabled;
		},
	},
	actions: {
		/**
		 * Toggles whether a chime sounds when a run finishes naturally, and
		 * remembers the choice across visits. Enabling sounds the chime once as
		 * audible confirmation, which also unlocks the audio context under this
		 * click (a user gesture) so a later, gesture-less finish can play.
		 */
		toggleSound(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();
			context.soundEnabled = ! context.soundEnabled;
			writeStoredSound( context.soundEnabled );

			if ( context.soundEnabled ) {
				instance.chime?.play();
			}
		},
	},
	callbacks: {
		/**
		 * Restores the remembered finish-sound preference onto the context and
		 * builds the chime. Run once on hydration; where Web Audio is absent the
		 * chime stays null and finish plays are silently skipped.
		 */
		initSound(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();
			context.soundEnabled = readStoredSound();

			const ctor = audioContextCtor();
			if ( ctor && ! instance.chime ) {
				instance.chime = new FinishChime( () => new ctor() );
			}
		},
	},
};
