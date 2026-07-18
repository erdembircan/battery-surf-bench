/**
 * The battery override resolver — the seam the dev-tools battery tool hooks
 * into. Pure and production-owned: with no override (or a disabled one) it is a
 * no-op passthrough, so the production behavior is unchanged when dev tools are
 * absent. Kept separate from {@link ./store/BatteryStore} so it can be unit-tested
 * without the Battery Status API or the Interactivity runtime.
 */

import { type BatteryReading } from '@/cockpit/BatteryMonitor';

/** The dev-tools battery override slice, as it lives on the shared cockpit state. */
export interface BatteryOverrideState {
	/** Forced charging state, or null to follow whatever the reading reports. */
	charging: boolean | null;
	/** Forced level (0–1), or null to follow whatever the reading reports. */
	level: number | null;
}

/**
 * Resolves the reading the rest of the cockpit acts on: the raw Battery Status
 * API reading with the dev-tools override substituted in. Passthrough
 * (returns `raw` unchanged) when there is no override or neither of its
 * fields is set — the production path with no dev tools loaded. There is no
 * separate "enabled" switch: every field already has its own explicit
 * off-state (`null` follows the system), so a field being set *is* the
 * override being in effect. When the platform reports no reading at all (the
 * Battery Status API is absent) but both fields are set, a full reading is
 * synthesized so the tool works on a browser with no battery API (Safari,
 * Firefox).
 *
 * @param raw      The raw Battery Status API reading, or null where the platform reports no battery support.
 * @param override The dev-tools battery override slice, if the dev-tools module has joined the store.
 * @return The reading the cockpit should act on, or null when there is nothing to report.
 */
export const resolveReading = (
	raw: BatteryReading | null,
	override?: BatteryOverrideState
): BatteryReading | null => {
	if ( ! override ) {
		return raw;
	}

	const { charging, level } = override;

	if ( charging === null && level === null ) {
		return raw;
	}

	if ( ! raw ) {
		return charging !== null && level !== null ? { charging, level } : null;
	}

	return {
		charging: charging !== null ? charging : raw.charging,
		level: level !== null ? level : raw.level,
	};
};
