/**
 * The dev-tools panel's shared shell: the persisted slice's shape, its
 * `localStorage` read/write/hydrate plumbing, and the panel open/closed
 * state. Every sub-tool (the battery override, the discharge simulation) is
 * its own focused module that reads and writes its own corner of this shared
 * slice through {@link current} — this module owns none of a sub-tool's own
 * logic, only the plumbing common to all of them, so a third sub-tool is
 * another module joining here, not a rework of this one.
 */

import { store } from '@wordpress/interactivity';
import { type StorePart } from '../cockpit/StoreParts';
import { type BatteryOverrideState } from '../cockpit/BatteryOverride';
import { type DischargeSimState, DEFAULT_SIM } from './DischargeSim';

/** The dev-tools slice of the shared `bsb/cockpit` state. */
export interface DevtoolsState {
	/** Whether the floating panel is expanded (vs. collapsed to its pill). */
	open: boolean;
	/** The battery-override sub-tool's state. */
	battery: BatteryOverrideState;
	/** The discharge-simulation sub-tool's state. */
	sim: DischargeSimState;
}

/**
 * The merged store shape sub-tool modules re-fetch by namespace.
 * `batterySystemPercent` is production-owned (published by
 * `src/cockpit/BatteryStore.ts`) — read by the battery sub-tool, never
 * written here.
 */
export interface DevtoolsStore {
	state: {
		devtools: DevtoolsState;
		batterySystemPercent?: number | null;
	};
}

/**
 * The slice's default, pre-hydration state. `sim` is a *copy* of
 * {@link DEFAULT_SIM}, never the constant itself — the Interactivity store
 * proxies this object directly, so writes the running app makes (stepping a
 * field, starting a run) would otherwise write through to the shared
 * `DEFAULT_SIM` module constant, corrupting the very defaults a later reset
 * reads back from.
 */
const DEFAULT_STATE: DevtoolsState = {
	open: false,
	battery: { charging: null, level: null },
	sim: { ...DEFAULT_SIM },
};

/**
 * `localStorage` key the slice persists under; bump the suffix on a shape
 * change — a stored value under a stale key is simply never read again
 * (`readStored()` looks up the current key only), so an old-shape blob is
 * inert rather than corrupting the new one.
 */
export const DEVTOOLS_STORAGE_KEY = 'bsb-devtools-v3';

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

	const { open, battery, sim } = value as Record< string, unknown >;

	if (
		typeof open !== 'boolean' ||
		typeof battery !== 'object' ||
		battery === null ||
		typeof sim !== 'object' ||
		sim === null
	) {
		return false;
	}

	const { charging, level } = battery as Record< string, unknown >;
	const { fromPercent, toPercent, minutes, running, startedAt } =
		sim as Record< string, unknown >;

	return (
		( charging === null || typeof charging === 'boolean' ) &&
		( level === null || typeof level === 'number' ) &&
		typeof fromPercent === 'number' &&
		typeof toPercent === 'number' &&
		typeof minutes === 'number' &&
		typeof running === 'boolean' &&
		( startedAt === null || typeof startedAt === 'number' )
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
export const current = (): DevtoolsState => {
	const { state } = store< DevtoolsStore >( 'bsb/cockpit' );

	return state.devtools;
};

/**
 * Restores the persisted devtools slice onto the shared state. Called once,
 * right after this module registers its store slice — not bound to a
 * directive — since by then the store already exists and `localStorage` needs
 * no DOM. Restores the raw fields only; resuming a running discharge sim from
 * its restored `startedAt` is the sim module's own concern
 * ({@link ./DischargeSimStore}.resumeDischargeSim), called separately right
 * after this.
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
	state.sim.fromPercent = stored.sim.fromPercent;
	state.sim.toPercent = stored.sim.toPercent;
	state.sim.minutes = stored.sim.minutes;
	state.sim.running = stored.sim.running;
	state.sim.startedAt = stored.sim.startedAt;
};

/** The shared shell: panel open/closed and the whole slice's persistence. */
export const devtoolsShellStore: StorePart = {
	state: {
		devtools: DEFAULT_STATE,
	},
	actions: {
		/** Expands or collapses the floating panel. */
		devtoolsToggleOpen(): void {
			const state = current();
			state.open = ! state.open;
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
				sim: { ...state.sim },
			} );
		},
	},
};
