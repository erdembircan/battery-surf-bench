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
import { type StorePart } from '@/cockpit/store/StoreParts';
import { type BatteryOverrideState } from '@/cockpit/BatteryOverride';
import { type DischargeSimState, DEFAULT_SIM } from '@/devtools/DischargeSim';
import { type SurfSteerState, DEFAULT_SURF } from '@/devtools/SurfSteer';
import {
	type SharkReleaseState,
	DEFAULT_SHARK_RELEASE,
} from '@/devtools/SharkRelease';

/** The dev-tools slice of the shared `bsb/cockpit` state. */
export interface DevtoolsState {
	/** Whether the floating panel is expanded (vs. collapsed to its pill). */
	open: boolean;
	/** The battery-override sub-tool's state. */
	battery: BatteryOverrideState;
	/** The discharge-simulation sub-tool's state. */
	sim: DischargeSimState;
	/** The Surf sub-tool's state: the armed sterile override, plus its live-run runtime fields. */
	surf: SurfSteerState;
	/** The shark-release sub-tool's state: the pending launch command plus its launchability mirror. */
	shark: SharkReleaseState;
}

/**
 * The subset of {@link DevtoolsState} that survives a reload. The discharge
 * sim is deliberately excluded — it is a live, in-session driver only, never
 * something a reload should resume: a page opened later with the surf engine
 * running would otherwise inherit a phantom drain from a session the user may
 * not even remember starting. The whole Surf tool is excluded for the same
 * reason, armed `sterile` flag included: a sterile override armed once must
 * never silently survive a reload or a later session and start a run sterile
 * without the user re-choosing it. `open` and `battery` are the only fields a
 * returning session should see again.
 * The shark-release tool never persists either: a released shark is a
 * moment, not a setting — there is nothing a reload could meaningfully
 * resume.
 */
type PersistedDevtoolsState = Pick< DevtoolsState, 'open' | 'battery' >;

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
	surf: { ...DEFAULT_SURF },
	shark: { ...DEFAULT_SHARK_RELEASE },
};

/**
 * `localStorage` key the slice persists under; bump the suffix on a shape
 * change — a stored value under a stale key is simply never read again
 * (`readStored()` looks up the current key only), so an old-shape blob is
 * inert rather than corrupting the new one. Bumped to v6 when the Surf
 * tool's armed `sterile` flag was REMOVED from the persisted shape — sterile
 * must never silently survive a reload, so a v5 blob carrying it is now
 * simply inert rather than read back.
 */
export const DEVTOOLS_STORAGE_KEY = 'bsb-devtools-v6';

/**
 * Narrows an unknown value to a well-formed {@link PersistedDevtoolsState}, so
 * a corrupted or stale-shape stored value is discarded rather than crashing
 * the panel.
 *
 * @param value The parsed `localStorage` value to check.
 * @return Whether the value is a well-formed persisted devtools state.
 */
const isPersistedDevtoolsState = (
	value: unknown
): value is PersistedDevtoolsState => {
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
const readStored = (): PersistedDevtoolsState | null => {
	try {
		const raw = window.localStorage.getItem( DEVTOOLS_STORAGE_KEY );

		if ( ! raw ) {
			return null;
		}

		const parsed: unknown = JSON.parse( raw );

		return isPersistedDevtoolsState( parsed ) ? parsed : null;
	} catch {
		return null;
	}
};

/**
 * Persists the devtools slice's persisted subset. Failures (private browsing,
 * quota, storage disabled) are swallowed — the override still works for the
 * session, it just will not survive a reload.
 *
 * @param state The persisted subset of devtools state to write.
 */
const writeStored = ( state: PersistedDevtoolsState ): void => {
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
 * no DOM. Restores `open` and `battery` only; the discharge sim is never
 * persisted, so it always starts a fresh session at its {@link DEFAULT_SIM}
 * default, never running — and the whole Surf tool, its armed `sterile` flag
 * included, always starts fresh too, at {@link DEFAULT_SURF}: a sterile
 * override must never silently survive a reload and start a later run
 * sterile without the user re-choosing it.
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
		 * Persists the devtools slice's persisted subset on every change. Bound
		 * via `data-wp-watch--devtools-persist` on the panel; reading the slice
		 * here is what makes it re-run reactively whenever any field changes.
		 * Only `open` and `battery` are written; the discharge sim and the
		 * whole Surf tool (its armed `sterile` flag included) are
		 * live-session-only and never land in storage.
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
