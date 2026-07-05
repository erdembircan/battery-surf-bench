/**
 * The battery-override sub-tool: the first (and, today, only) section of the
 * dev-tools panel. Joins the `bsb/cockpit` store from a separate script
 * module, so every member it contributes carries a `devtools` prefix — the
 * store-merge rule is that a later-registered member overrides a same-named
 * one, and this namespacing is what keeps the tool from ever clobbering a
 * production member.
 *
 * There is no separate "enabled" switch for the sub-tool: every field already
 * has its own explicit off-state (`null` follows the system), so a field
 * being set *is* the override being in effect — the same mental model for
 * charging (System / Charging / Discharging) and level (System, or a dragged
 * value).
 *
 * The whole `devtools` slice (panel open/closed, the battery section) is
 * persisted to `localStorage` so a reload does not snap the override back to
 * the real charging state mid-investigation; {@link hydrateDevtools} restores
 * it once the store exists, and the `devtoolsPersist` callback (bound via
 * `data-wp-watch` on the panel) writes every change back out.
 */

import { store, getElement } from '@wordpress/interactivity';
import { type StorePart } from '../cockpit/StoreParts';
import { type BatteryOverrideState } from '../cockpit/BatteryOverride';

/** The dev-tools slice of the shared `bsb/cockpit` state. */
export interface DevtoolsState {
	/** Whether the floating panel is expanded (vs. collapsed to its pill). */
	open: boolean;
	/** The battery-override sub-tool's state. */
	battery: BatteryOverrideState;
}

/**
 * The merged store shape the slice's actions/callbacks re-fetch by namespace.
 * `batterySystemPercent` is production-owned (published by
 * `src/cockpit/BatteryStore.ts`) — read here, never written.
 */
interface DevtoolsStore {
	state: {
		devtools: DevtoolsState;
		batterySystemPercent?: number | null;
	};
}

/** The slice's default, pre-hydration state. */
const DEFAULT_STATE: DevtoolsState = {
	open: false,
	battery: { charging: null, level: null },
};

/**
 * `localStorage` key the slice persists under; bump the suffix on a shape
 * change — a stored value under a stale key is simply never read again
 * (`readStored()` looks up the current key only), so an old-shape blob is
 * inert rather than corrupting the new one.
 */
export const DEVTOOLS_STORAGE_KEY = 'bsb-devtools-v2';

/**
 * Narrows an unknown value to a well-formed {@link DevtoolsState}, so a
 * corrupted or stale-shape stored value is discarded rather than crashing the
 * panel.
 *
 * @param value The parsed `localStorage` value to check.
 * @return Whether the value is a well-formed devtools state.
 */
const isDevtoolsState = ( value: unknown ): value is DevtoolsState => {
	if ( typeof value !== 'object' || value === null ) {
		return false;
	}

	const { open, battery } = value as Record< string, unknown >;

	if (
		typeof open !== 'boolean' ||
		typeof battery !== 'object' ||
		battery === null
	) {
		return false;
	}

	const { charging, level } = battery as Record< string, unknown >;

	return (
		( charging === null || typeof charging === 'boolean' ) &&
		( level === null || typeof level === 'number' )
	);
};

/**
 * Reads the persisted devtools slice, or null where nothing is stored, storage
 * is unavailable, or the stored value no longer matches the expected shape.
 *
 * @return The stored state, or null.
 */
const readStored = (): DevtoolsState | null => {
	try {
		const raw = window.localStorage.getItem( DEVTOOLS_STORAGE_KEY );

		if ( ! raw ) {
			return null;
		}

		const parsed: unknown = JSON.parse( raw );

		return isDevtoolsState( parsed ) ? parsed : null;
	} catch {
		return null;
	}
};

/**
 * Persists the devtools slice. Failures (private browsing, quota, storage
 * disabled) are swallowed — the override still works for the session, it just
 * will not survive a reload.
 *
 * @param state The devtools state to persist.
 */
const writeStored = ( state: DevtoolsState ): void => {
	try {
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( state )
		);
	} catch {
		// Storage unavailable; nothing to do.
	}
};

/**
 * The live devtools slice off the shared `bsb/cockpit` state. Re-fetched by
 * namespace on every call (rather than captured once at import time) because
 * this module and the production cockpit module each join the store from
 * separate script modules, in an order neither can rely on.
 *
 * @return The shared devtools state.
 */
const current = (): DevtoolsState => {
	const { state } = store< DevtoolsStore >( 'bsb/cockpit' );

	return state.devtools;
};

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

/**
 * Restores the persisted devtools slice onto the shared state. Called once,
 * right after this module registers its store slice — not bound to a directive
 * — since by then the store already exists and `localStorage` needs no DOM.
 */
export const hydrateDevtools = (): void => {
	const stored = readStored();

	if ( ! stored ) {
		return;
	}

	const state = current();
	state.open = stored.open;
	state.battery.charging = stored.battery.charging;
	state.battery.level = stored.battery.level;
};

/** The battery-override section of the dev-tools panel, joining `bsb/cockpit`. */
export const batteryOverrideStore: StorePart = {
	state: {
		devtools: DEFAULT_STATE,

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

		/** Whether the level override is armed (a value has been dragged in). */
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
		 * than System, or a dragged-in level. There is no separate "enabled"
		 * switch — each field already carries its own off-state (`null`
		 * follows the system), so a field being set is what "armed" means.
		 * Drives the pill's coral state and the card header's "Override
		 * active" text.
		 */
		get devtoolsIsArmed(): boolean {
			const { charging, level } = current().battery;

			return charging !== null || level !== null;
		},
	},
	actions: {
		/** Expands or collapses the floating panel. */
		devtoolsToggleOpen(): void {
			const state = current();
			state.open = ! state.open;
		},

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
	callbacks: {
		/**
		 * Persists the devtools slice on every change. Bound via
		 * `data-wp-watch--devtools-persist` on the panel; reading the slice here is
		 * what makes it re-run reactively whenever any field changes.
		 */
		devtoolsPersist(): void {
			const state = current();

			writeStored( {
				open: state.open,
				battery: { ...state.battery },
			} );
		},
	},
};
