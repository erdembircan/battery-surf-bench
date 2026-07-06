/**
 * Tests for the dev-tools panel's cross-cutting Reset action: clearing both
 * the battery-override fields and stopping/restoring a running discharge sim
 * in one call. The sub-tools' own actions/getters are already covered in
 * `BatteryOverrideStore.test.ts` and `DischargeSimStore.test.ts`; this file
 * only proves the composition — that `devtoolsReset` reaches into both.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

interface MockSim {
	fromPercent: number;
	toPercent: number;
	minutes: number;
	running: boolean;
	startedAt: number | null;
	currentLevel: number | null;
}

interface MockDevtoolsState {
	open: boolean;
	battery: { charging: boolean | null; level: number | null };
	sim: MockSim;
}

const mocks = vi.hoisted( () => ( {
	state: undefined as unknown as { devtools: MockDevtoolsState },
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: () => ( { state: mocks.state } ),
	getElement: () => ( { ref: null } ),
} ) );

import { resetStore } from './ResetStore';
import { dischargeSimStore } from './DischargeSimStore';
import { devtoolsShellStore } from './DevtoolsStore';

const actions = resetStore.actions as unknown as {
	devtoolsReset: () => void;
};

/** The sim's Start/Stop toggle, used only to drive a running sim for setup. */
const simActions = dischargeSimStore.actions as unknown as {
	devtoolsToggleSim: () => void;
};

const defaultSim = (): MockSim => ( {
	fromPercent: 90,
	toPercent: 20,
	minutes: 30,
	running: false,
	startedAt: null,
	currentLevel: null,
} );

beforeEach( () => {
	vi.useFakeTimers();
	vi.setSystemTime( new Date( '2026-01-01T00:00:00.000Z' ) );
	mocks.state = {
		devtools: {
			open: false,
			battery: { charging: null, level: null },
			sim: defaultSim(),
		},
	};
} );

afterEach( () => {
	// Stop any ticker a test left running so it cannot leak into the next one.
	if ( mocks.state.devtools.sim.running ) {
		simActions.devtoolsToggleSim();
	}
	vi.useRealTimers();
} );

describe( 'devtoolsReset', () => {
	it( 'clears both the charging and level overrides back to "follow the system"', () => {
		mocks.state.devtools.battery = { charging: true, level: 0.42 };

		actions.devtoolsReset();

		expect( mocks.state.devtools.battery.charging ).toBeNull();
		expect( mocks.state.devtools.battery.level ).toBeNull();
	} );

	it( 'stops a running sim and the ticker no longer writes afterward', () => {
		simActions.devtoolsToggleSim();
		expect( mocks.state.devtools.sim.running ).toBe( true );

		actions.devtoolsReset();

		expect( mocks.state.devtools.sim.running ).toBe( false );
		expect( mocks.state.devtools.sim.startedAt ).toBeNull();
		expect( mocks.state.devtools.sim.currentLevel ).toBeNull();

		// The ticker really stopped: advancing the clock must not resurrect a
		// forced level, on either the sim's own field or the manual layer.
		vi.advanceTimersByTime( 60_000 );
		expect( mocks.state.devtools.sim.currentLevel ).toBeNull();
		expect( mocks.state.devtools.battery.level ).toBeNull();
	} );

	it( 'restores the sim steppers to their defaults after they were changed', () => {
		mocks.state.devtools.sim.fromPercent = 60;
		mocks.state.devtools.sim.toPercent = 10;
		mocks.state.devtools.sim.minutes = 45;

		actions.devtoolsReset();

		expect( mocks.state.devtools.sim.fromPercent ).toBe( 90 );
		expect( mocks.state.devtools.sim.toPercent ).toBe( 20 );
		expect( mocks.state.devtools.sim.minutes ).toBe( 30 );
	} );

	it( 'is idempotent on pristine state — resetting defaults throws nothing and leaves them intact', () => {
		expect( () => actions.devtoolsReset() ).not.toThrow();

		expect( mocks.state.devtools.battery ).toEqual( {
			charging: null,
			level: null,
		} );
		expect( mocks.state.devtools.sim ).toEqual( defaultSim() );
	} );
} );

describe( 'devtoolsReset against the real DEFAULT_STATE wiring (regression)', () => {
	// Every test above substitutes a hand-built literal for `mocks.state`,
	// which is exactly why they would not have caught this: `current()` in
	// production reads `devtoolsShellStore.state.devtools`, the module-level
	// `DEFAULT_STATE` singleton — `DevtoolsStore` used to point its `sim`
	// field straight at the `DEFAULT_SIM` module constant (not a copy), so
	// stepping a field wrote through to `DEFAULT_SIM` itself, and a later
	// reset "restored" the steppers from the very values it had just
	// corrupted — a silent no-op rather than an actual reset. Using the real
	// singleton here, instead of a fresh literal, is what exercises that
	// shared-reference path.
	const realDevtoolsState = devtoolsShellStore.state as unknown as {
		devtools: MockDevtoolsState;
	};
	const realDevtools = realDevtoolsState.devtools;

	beforeEach( () => {
		// The singleton is module-level, so mutate its existing fields back to
		// pristine defaults in place — never replace `.sim` with a new object,
		// which would substitute away the very reference identity this test
		// depends on — so nothing leaks into another test.
		realDevtools.open = false;
		realDevtools.battery.charging = null;
		realDevtools.battery.level = null;
		realDevtools.sim.running = false;
		realDevtools.sim.startedAt = null;
		realDevtools.sim.currentLevel = null;
		realDevtools.sim.fromPercent = 90;
		realDevtools.sim.toPercent = 20;
		realDevtools.sim.minutes = 30;
		mocks.state = { devtools: realDevtools };
	} );

	afterEach( () => {
		if ( realDevtools.sim.running ) {
			simActions.devtoolsToggleSim();
		}
	} );

	it( 'restores minutes to 30 after it was changed, using the real singleton `sim` object', () => {
		// Simulates what stepping the minutes field down does to the shared
		// object the store proxies — direct field mutation, the same effect
		// `devtoolsStepSim` has on `current().sim`.
		realDevtools.sim.minutes = 5;

		actions.devtoolsReset();

		expect( realDevtools.sim.minutes ).toBe( 30 );
	} );
} );
