import { type BatteryOverrideState } from '../cockpit/BatteryOverride';

export interface EffectiveOverrideSource {
	battery: BatteryOverrideState;
	sim?: { running: boolean; currentLevel: number | null };
}

/**
 * The battery-override resolver: computes the single effective override from
 * the two layers the dev-tools panel can independently arm — the manual
 * override (`battery`, each field its own "follow the system" off-state) and
 * the discharge-simulation sub-tool (`sim`). The two layers never write to
 * each other's fields; this pure function is what composes them into the one
 * `BatteryOverrideState` the rest of the cockpit (see
 * `../cockpit/BatteryStore`) and the dev-tools panel's own getters (see
 * `./BatteryOverrideStore`) act on.
 *
 * A running sim always wins outright rather than blending with the manual
 * layer underneath — the panel's own UI already makes the two mutually
 * exclusive (the manual level slider stays live, but a running sim's ticker
 * overwrites the display every tick anyway) — and a running sim always means
 * actively discharging. Stopping the sim (or letting it complete) simply
 * stops it winning: whatever the manual layer holds underneath — a prior
 * override, or `{null, null}` to follow the system — is what the cockpit
 * reverts to, with nothing left to reset.
 *
 * Pure and reads only the state handed to it — never the wall clock — so a
 * sim tick (which writes `sim.currentLevel`, not the wall clock, every
 * second) is exactly what makes a reactive watch reading through this
 * resolver re-run live, and so this module needs no store or DOM access to
 * unit-test.
 *
 * @param devtools The devtools slice's battery-relevant fields: the manual override layer, and the sim's running flag and live level.
 * @return The effective override the cockpit's battery seam should apply.
 */
export const effectiveBatteryOverride = (
	devtools: EffectiveOverrideSource
): BatteryOverrideState => {
	if ( devtools.sim?.running ) {
		return { charging: false, level: devtools.sim.currentLevel };
	}

	return devtools.battery;
};
