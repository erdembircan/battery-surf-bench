/**
 * The battery-override sub-tool: the first (and, today, only) section of the
 * dev-tools panel. Joins the `bsb/cockpit` store from a separate script
 * module, so every member it contributes carries a `devtools` prefix — the
 * store-merge rule is that a later-registered member overrides a same-named
 * one, and this namespacing is what keeps the tool from ever clobbering a
 * production member.
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

/** The merged store shape the slice's actions/callbacks re-fetch by namespace. */
interface DevtoolsStore {
	state: { devtools: DevtoolsState };
}

/** The slice's default, pre-hydration state. */
const DEFAULT_STATE: DevtoolsState = {
	open: false,
	battery: { enabled: false, charging: null, level: null },
};

/** `localStorage` key the slice persists under; bump the suffix on a shape change. */
export const DEVTOOLS_STORAGE_KEY = 'bsb-devtools-v1';

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

	const { enabled, charging, level } = battery as Record< string, unknown >;

	return (
		typeof enabled === 'boolean' &&
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
	state.battery.enabled = stored.battery.enabled;
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

		/** Whether the level override is armed. */
		get devtoolsIsLevelForced(): boolean {
			return current().battery.level !== null;
		},

		/** The level override as a 0–100 slider value, defaulting to 50 when unarmed. */
		get devtoolsLevelPercent(): number {
			const { level } = current().battery;

			return level === null ? 50 : Math.round( level * 100 );
		},
	},
	actions: {
		/** Expands or collapses the floating panel. */
		devtoolsToggleOpen(): void {
			const state = current();
			state.open = ! state.open;
		},

		/** Arms or disarms the battery sub-tool; disarmed ignores every field. */
		devtoolsToggleBatteryEnabled(): void {
			const state = current();
			state.battery.enabled = ! state.battery.enabled;
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

		/** Arms the level override (seeding it at the current slider value) or disarms it. */
		devtoolsToggleLevel(): void {
			const state = current();
			state.battery.level = state.battery.level === null ? 0.5 : null;
		},

		/** Sets the level override from the triggering range input's value (0–100). */
		devtoolsSetLevel(): void {
			const { ref } = getElement();
			const raw = Number( ( ref as HTMLInputElement | null )?.value );

			if ( ! Number.isFinite( raw ) ) {
				return;
			}

			current().battery.level = Math.min( 1, Math.max( 0, raw / 100 ) );
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
