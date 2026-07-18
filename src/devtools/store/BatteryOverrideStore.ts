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
 * value). This module's own getters and actions read and write its manual
 * `battery` layer only; while a discharge sim (see {@link ./DischargeSimStore})
 * is running it wins over this layer entirely, resolved by the pure
 * {@link ../EffectiveBatteryOverride} — the getters below route through that
 * resolver so the panel reflects a running sim, but the actions never need to
 * know the sim exists.
 *
 * The shared slice's persistence (`localStorage`, hydration) lives in
 * {@link ./DevtoolsStore} — this module only owns the battery tool's own
 * getters and actions. It also exports {@link resetBatteryOverride}, a plain
 * function rather than a `StorePart` action — the panel's cross-cutting Reset
 * button ({@link ./ResetStore}) composes it directly, so this sub-tool's own
 * reset logic lives here, next to the fields it clears.
 */

import { store, getElement } from '@wordpress/interactivity';
import { type StorePart } from '@/cockpit/store/StoreParts';
import { current, type DevtoolsStore } from '@/devtools/store/DevtoolsStore';
import { effectiveBatteryOverride } from '@/devtools/EffectiveBatteryOverride';

/**
 * The raw system battery percentage published by the production cockpit
 * ({@link ../../cockpit/store/BatteryStore}), or null before any real reading exists
 * (or on a platform with no Battery Status API and nothing synthesized).
 *
 * @return The live system percentage, or null.
 */
const systemPercent = (): number | null => {
	const { state } = store< DevtoolsStore >( 'bsb/cockpit' );

	return state.batterySystemPercent ?? null;
};

/**
 * Clears both battery-override fields back to "follow the system" — the
 * charging tri-state's own off-state and the level row's own off-state at
 * once. Exported (rather than folded into a `StorePart` action) so the
 * panel's cross-cutting Reset button ({@link ./ResetStore}) can call it
 * directly without a second store member — the panel-wide reset composes
 * this sub-tool's own reset rather than duplicating its logic.
 */
export const resetBatteryOverride = (): void => {
	current().battery.charging = null;
	current().battery.level = null;
};

/**
 * The level row's displayed percentage: the forced value while armed
 * (including a level a running discharge sim is driving), the live system
 * reading while following it, falling back to 50 only when no system reading
 * exists at all.
 *
 * @return The percentage the level row should display, 0–100.
 */
const displayedLevelPercent = (): number => {
	const { level } = effectiveBatteryOverride( current() );

	if ( level !== null ) {
		return Math.round( level * 100 );
	}

	return systemPercent() ?? 50;
};

/** The battery-override section of the dev-tools panel, joining `bsb/cockpit`. */
export const batteryOverrideStore: StorePart = {
	state: {
		/**
		 * Whether the charging override follows the real (system) reading —
		 * false while a discharge sim is running, since a running sim always
		 * forces discharging.
		 */
		get devtoolsIsChargingSystem(): boolean {
			return effectiveBatteryOverride( current() ).charging === null;
		},

		/** Whether charging is forced on. */
		get devtoolsIsChargingOn(): boolean {
			return effectiveBatteryOverride( current() ).charging === true;
		},

		/**
		 * Whether charging is forced off (discharging) — true either from a
		 * manual choice or because a discharge sim is currently running.
		 */
		get devtoolsIsChargingOff(): boolean {
			return effectiveBatteryOverride( current() ).charging === false;
		},

		/** Whether the level override is armed (a value has been dragged in, or a discharge sim is driving it). */
		get devtoolsIsLevelForced(): boolean {
			return effectiveBatteryOverride( current() ).level !== null;
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
		 * than System, a forced level (dragged in by hand), a running
		 * discharge sim, or the Surf tool's sterile override armed — checked
		 * directly here (not through the resolver) since a sim with
		 * `{null, null}` still sitting underneath in the manual layer must
		 * still read as armed. There is no separate "enabled" switch
		 * otherwise — each manual field already carries its own off-state
		 * (`null` follows the system), so a field being set is what "armed"
		 * means. Drives the pill's coral state and the card header's
		 * "Override active" text.
		 */
		get devtoolsIsArmed(): boolean {
			const { battery, sim, surf } = current();

			return (
				battery.charging !== null ||
				battery.level !== null ||
				sim.running ||
				surf.sterile
			);
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
