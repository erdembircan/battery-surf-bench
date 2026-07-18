/**
 * The dev-tools panel's cross-cutting Reset button: a single action that
 * clears every override the panel can arm, including stopping a running
 * discharge simulation. It lives in its own module rather than
 * {@link ./DevtoolsStore} — the panel's shared shell — because both sub-tool
 * modules ({@link ./BatteryOverrideStore}, {@link ./DischargeSimStore})
 * already import `current` from that shell; if the shell also composed the
 * cross-cutting reset, it would need to import each sub-tool's reset back,
 * forming a sub-tool → shell → sub-tool import cycle. Sitting to the side
 * instead, this module imports from both sub-tools and neither of them
 * imports from it, so no cycle forms.
 *
 * `devtoolsReset` does not touch `state.devtools.open` — the panel stays open
 * so the maintainer sees every field return to its default — and never calls
 * `callbacks.devtoolsPersist` itself: that callback is bound via
 * `data-wp-watch--devtools-persist` on the panel and already re-runs
 * reactively whenever the state it reads changes, so an explicit persistence
 * call here would be redundant.
 */

import { type StorePart } from '@/cockpit/store/StoreParts';
import { resetBatteryOverride } from '@/devtools/store/BatteryOverrideStore';
import { resetDischargeSim } from '@/devtools/store/DischargeSimStore';
import { resetSurfSteer } from '@/devtools/store/SurfSteerStore';

/** The dev-tools panel's cross-cutting reset, joining `bsb/cockpit`. */
export const resetStore: StorePart = {
	actions: {
		/**
		 * Resets every dev-tools override in one click: clears the charging and
		 * level overrides back to "follow the system", stops a running
		 * discharge sim (restoring its steppers to their defaults), and
		 * disarms the Surf tool's sterile override (clearing every runtime
		 * field).
		 */
		devtoolsReset(): void {
			resetBatteryOverride();
			resetDischargeSim();
			resetSurfSteer();
		},
	},
};
