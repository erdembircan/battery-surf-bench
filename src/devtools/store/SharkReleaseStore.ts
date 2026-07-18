/**
 * The shark-release sub-tool: the dev-tools panel header's shark button,
 * joining `bsb/cockpit` from a separate script module like every other
 * sub-tool (see {@link ./BatteryOverrideStore}'s doc comment for the
 * namespacing rule). Releasing writes a stamped one-shot launch command onto
 * the shared devtools slice — the panel sits outside the cockpit block and
 * has no cockpit context of its own, so it can never call the swim lifecycle
 * directly; the cockpit's own `SharkStore.syncDevtoolsShark` watch observes
 * the command from inside a valid scope and launches the swim, the exact
 * bridge {@link ./SurfSteerStore}'s page stepper rides. The cockpit mirrors
 * launchability (run live, deck compact) back onto the slice the same way,
 * which is all the disabled binding below reads.
 */

import { type StorePart } from '@/cockpit/store/StoreParts';
import { current } from '@/devtools/store/DevtoolsStore';

/** Monotonic sequence stamped onto every launch command, so the cockpit watch (which reads it reactively) re-fires even on a repeat release. */
let sharkSeq = 0;

/** The shark-release section of the dev-tools panel, joining `bsb/cockpit`. */
export const sharkReleaseStore: StorePart = {
	state: {
		/** Whether the shark button is disabled — no run live, or the deck not compact, per the cockpit's launchability mirror. */
		get devtoolsSharkDisabled(): boolean {
			return ! current().shark.launchable;
		},
	},
	actions: {
		/**
		 * Releases a shark: writes a launch command stamped with a fresh
		 * monotonic sequence for the cockpit watch to consume. A no-op while
		 * nothing could launch — the disabled binding already keeps this from
		 * firing by a real click, but a forced/tampered call is guarded the
		 * same way.
		 */
		devtoolsReleaseShark(): void {
			const { shark } = current();

			if ( ! shark.launchable ) {
				return;
			}

			sharkSeq += 1;
			shark.launch = { seq: sharkSeq };
		},
	},
};
