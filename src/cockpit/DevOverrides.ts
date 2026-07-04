/**
 * Dev-build-only battery overrides — the single seam every dev tool transforms
 * a battery reading through before the store consumes it. Production code
 * touches only {@link applyDevOverrides} (one property read when inactive,
 * folded to a no-op cost) and never the dev-tools panel itself, which is
 * excluded from production bundles entirely (see `view.ts`).
 *
 * Bypassing the charging gate here — rather than checking a flag at each of the
 * three places that read `batteryCharging` — means every downstream consumer
 * (the start gate, the imperative refusal, the mid-run stop, the sample log,
 * the drain fit) coherently sees "on battery" from one transform, so a bypassed
 * run is a complete run rather than gates-open-but-nothing-recorded.
 */

import { type BatteryReading } from './BatteryMonitor';

/** The dev-tools override state. */
export interface DevOverridesState {
	/** Whether the charging gate is being bypassed. */
	bypassCharging: boolean;
	/** Last raw `charging` truth seen while bypassing, or null if never seen. */
	actualCharging: boolean | null;
}

/** The dev-tools override state — a module singleton, seeded to inactive. */
export const devOverrides: DevOverridesState = {
	bypassCharging: false,
	actualCharging: null,
};

/** Subscribers notified whenever an override transforms a reading. */
const listeners = new Set< () => void >();

/**
 * Transforms a raw battery reading through the active dev overrides. Returns
 * the raw reading unchanged when no override is active; never mutates it.
 *
 * @param raw The reading as reported by the Battery Status API.
 * @return The reading the rest of the cockpit should see.
 */
export const applyDevOverrides = ( raw: BatteryReading ): BatteryReading => {
	if ( ! devOverrides.bypassCharging ) {
		return raw;
	}

	devOverrides.actualCharging = raw.charging;
	listeners.forEach( ( listener ) => listener() );

	return { ...raw, charging: false };
};

/**
 * Subscribes to every reading the overrides transform, so the dev-tools panel
 * can keep its "actually plugged in / on battery" line current.
 *
 * @param listener Called after each transformed reading.
 * @return An unsubscribe function.
 */
export const onDevReading = ( listener: () => void ): ( () => void ) => {
	listeners.add( listener );

	return () => listeners.delete( listener );
};
