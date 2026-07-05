/**
 * The battery-override sub-tool: one of the dev-tools panel's sections,
 * joining the `bsb/cockpit` store from a separate script module, so every
 * member it contributes carries a `devtools` prefix — the store-merge rule is
 * that a later-registered member overrides a same-named one, and this
 * namespacing is what keeps the tool from ever clobbering a production
 * member.
 *
 * There is no separate "enabled" switch for the sub-tool: every field already
 * has its own explicit off-state (`null` follows the system), so a field
 * being set *is* the override being in effect — the same mental model for
 * charging (System / Charging / Discharging) and level (System, or a dragged
 * value — including one driven by the discharge-simulation sub-tool, see
 * {@link ./DischargeSimStore}, which writes into this same `level` field
 * rather than introducing a second one).
 *
 * The shared slice's persistence (`localStorage`, hydration) lives in
 * {@link ./DevtoolsStore} — this module only owns the battery tool's own
 * getters and actions.
 */

import { store, getElement } from '@wordpress/interactivity';
import { type StorePart } from '../cockpit/StoreParts';
import { current, type DevtoolsStore } from './DevtoolsStore';

/**
 * The raw system battery percentage published by the production cockpit
 * ({@link ../cockpit/BatteryStore}), or null before any real reading exists
 * (or on a platform with no Battery Status API and nothing synthesized).
 *
 * @return The live system percentage, or null.
 */
const systemPercent = (): number | null => {
	const { state } = store< DevtoolsStore >( 'bsb/cockpit' );

	return state.batterySystemPercent ?? null;
};

/**
 * The level row's displayed percentage: the forced value while armed, the
 * live system reading while following it, falling back to 50 only when no
 * system reading exists at all.
 *
 * @return The percentage the level row should display, 0–100.
 */
const displayedLevelPercent = (): number => {
	const { level } = current().battery;

	if ( level !== null ) {
		return Math.round( level * 100 );
	}

	return systemPercent() ?? 50;
};

/** The battery-override section of the dev-tools panel, joining `bsb/cockpit`. */
export const batteryOverrideStore: StorePart = {
	state: {
		/** Whether the charging override follows the real (system) reading. */
		get devtoolsIsChargingSystem(): boolean {
			return current().battery.charging === null;
		},

		/** Whether charging is forced on. */
		get devtoolsIsChargingOn(): boolean {
			return current().battery.charging === true;
		},

		/** Whether charging is forced off (discharging). */
		get devtoolsIsChargingOff(): boolean {
			return current().battery.charging === false;
		},

		/** Whether the level override is armed (a value has been dragged in, or a discharge sim is driving it). */
		get devtoolsIsLevelForced(): boolean {
			return current().battery.level !== null;
		},

		/**
		 * The level row's 0–100 slider value: the forced level while armed, the
		 * live system battery percentage while following it (updating as new
		 * readings arrive), or 50 only when no system reading exists at all
		 * (no Battery Status API and nothing synthesized).
		 */
		get devtoolsLevelPercent(): number {
			return displayedLevelPercent();
		},

		/**
		 * The level row's percentage as a CSS string, for the slider track's
		 * `--fill` custom property (`data-wp-style` binds a string value, not a
		 * bare number).
		 */
		get devtoolsLevelFillPercent(): string {
			return `${ displayedLevelPercent() }%`;
		},

		/**
		 * Whether an override is actually in effect: a charging choice other
		 * than System, or a forced level (dragged in by hand, or driven by a
		 * running discharge sim). There is no separate "enabled" switch — each
		 * field already carries its own off-state (`null` follows the system),
		 * so a field being set is what "armed" means. Drives the pill's coral
		 * state and the card header's "Override active" text.
		 */
		get devtoolsIsArmed(): boolean {
			const { charging, level } = current().battery;

			return charging !== null || level !== null;
		},
	},
	actions: {
		/**
		 * Sets the charging override from the triggering control's
		 * `data-devtools-charging` (`system` | `charging` | `discharging`).
		 */
		devtoolsSetCharging(): void {
			const { ref } = getElement();
			const choice = ( ref as HTMLElement | null )?.dataset
				.devtoolsCharging;

			if (
				choice !== 'system' &&
				choice !== 'charging' &&
				choice !== 'discharging'
			) {
				return;
			}

			current().battery.charging =
				choice === 'system' ? null : choice === 'charging';
		},

		/**
		 * Sets the level override from the triggering range input's value
		 * (0–100), snapped to the nearest 5% step — the input's own `step="5"`
		 * already yields that from a real drag or keyboard nudge, but this
		 * quantizes defensively regardless of how the value arrived, so a
		 * forced level is always a multiple of 5. Dragging the slider is
		 * itself what arms the override — there is no separate toggle to flip
		 * first. This is the *forced* value only; the System-mirrored display
		 * (see {@link displayedLevelPercent}) shows the real reading unsnapped.
		 */
		devtoolsSetLevel(): void {
			const { ref } = getElement();
			const raw = Number( ( ref as HTMLInputElement | null )?.value );

			if ( ! Number.isFinite( raw ) ) {
				return;
			}

			const snapped = Math.round( raw / 5 ) * 5;
			current().battery.level = Math.min(
				1,
				Math.max( 0, snapped / 100 )
			);
		},

		/**
		 * Clears the level override back to "follow the system" — the
		 * level row's System button, the same off-state gesture as picking
		 * System in the charging row.
		 */
		devtoolsResetLevel(): void {
			current().battery.level = null;
		},
	},
};
