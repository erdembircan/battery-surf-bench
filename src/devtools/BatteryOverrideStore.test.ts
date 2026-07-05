/**
 * Tests for the battery-override sub-tool slice.
 *
 * The slice's own actions/getters/callbacks read and write the shared
 * `bsb/cockpit` state through `store()`; this file stubs that call to return a
 * single, test-owned state object so the tests exercise these functions the
 * same way the real merged store would use them, without the cockpit's own
 * modules or the Interactivity runtime.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

/** A stand-in for the element that triggered an action. */
interface MockElement {
	dataset: Record< string, string >;
	value: string;
}

interface DevtoolsBatteryOverride {
	charging: boolean | null;
	level: number | null;
}

interface DevtoolsState {
	open: boolean;
	battery: DevtoolsBatteryOverride;
}

const mocks = vi.hoisted( () => ( {
	state: undefined as unknown as {
		devtools: DevtoolsState;
		batterySystemPercent?: number | null;
	},
	element: { dataset: {}, value: '' } as MockElement,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: () => ( { state: mocks.state } ),
	getElement: () => ( { ref: mocks.element } ),
} ) );

import {
	batteryOverrideStore,
	hydrateDevtools,
	DEVTOOLS_STORAGE_KEY,
} from './BatteryOverrideStore';

/** Typed views over the loosely-typed `StorePart` slice under test. */
const actions = batteryOverrideStore.actions as unknown as {
	devtoolsToggleOpen: () => void;
	devtoolsSetCharging: () => void;
	devtoolsSetLevel: () => void;
	devtoolsResetLevel: () => void;
};
const derived = batteryOverrideStore.state as unknown as {
	devtoolsIsChargingSystem: boolean;
	devtoolsIsChargingOn: boolean;
	devtoolsIsChargingOff: boolean;
	devtoolsIsLevelForced: boolean;
	devtoolsLevelPercent: number;
	devtoolsLevelFillPercent: string;
	devtoolsIsArmed: boolean;
};
const callbacks = batteryOverrideStore.callbacks as unknown as {
	devtoolsPersist: () => void;
};

beforeEach( () => {
	mocks.state = {
		devtools: {
			open: false,
			battery: { charging: null, level: null },
		},
		batterySystemPercent: null,
	};
	mocks.element = { dataset: {}, value: '' };
	window.localStorage.clear();
} );

describe( 'batteryOverrideStore actions', () => {
	it( 'toggles the panel open state', () => {
		actions.devtoolsToggleOpen();
		expect( mocks.state.devtools.open ).toBe( true );

		actions.devtoolsToggleOpen();
		expect( mocks.state.devtools.open ).toBe( false );
	} );

	it( 'sets the charging override from the triggering control’s dataset', () => {
		mocks.element = {
			dataset: { devtoolsCharging: 'charging' },
			value: '',
		};
		actions.devtoolsSetCharging();
		expect( mocks.state.devtools.battery.charging ).toBe( true );

		mocks.element = {
			dataset: { devtoolsCharging: 'discharging' },
			value: '',
		};
		actions.devtoolsSetCharging();
		expect( mocks.state.devtools.battery.charging ).toBe( false );

		mocks.element = { dataset: { devtoolsCharging: 'system' }, value: '' };
		actions.devtoolsSetCharging();
		expect( mocks.state.devtools.battery.charging ).toBeNull();
	} );

	it( 'ignores an unrecognized charging choice', () => {
		mocks.state.devtools.battery.charging = true;
		mocks.element = { dataset: { devtoolsCharging: 'bogus' }, value: '' };

		actions.devtoolsSetCharging();

		expect( mocks.state.devtools.battery.charging ).toBe( true );
	} );

	it( 'dragging the slider arms the level override directly — no toggle to flip first', () => {
		expect( mocks.state.devtools.battery.level ).toBeNull();

		mocks.element = { dataset: {}, value: '30' };
		actions.devtoolsSetLevel();

		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.3 );
	} );

	it( 'snaps the forced level to the nearest 5% step regardless of the raw input value', () => {
		mocks.element = { dataset: {}, value: '33' };
		actions.devtoolsSetLevel();
		// 33 rounds to the nearest step of 5 → 35.
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.35 );

		mocks.element = { dataset: {}, value: '2' };
		actions.devtoolsSetLevel();
		// 2 rounds down to 0.
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0 );

		mocks.element = { dataset: {}, value: '98' };
		actions.devtoolsSetLevel();
		// 98 rounds up to 100.
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 1 );
	} );

	it( 'ignores a non-numeric range value', () => {
		mocks.element = { dataset: {}, value: 'not-a-number' };

		actions.devtoolsSetLevel();

		expect( mocks.state.devtools.battery.level ).toBeNull();
	} );

	it( 'the level System button clears a dragged-in level back to null', () => {
		mocks.state.devtools.battery.level = 0.7;

		actions.devtoolsResetLevel();

		expect( mocks.state.devtools.battery.level ).toBeNull();
	} );
} );

describe( 'batteryOverrideStore derived state', () => {
	it( 'reads the charging tri-state', () => {
		expect( derived.devtoolsIsChargingSystem ).toBe( true );

		mocks.state.devtools.battery.charging = true;
		expect( derived.devtoolsIsChargingOn ).toBe( true );

		mocks.state.devtools.battery.charging = false;
		expect( derived.devtoolsIsChargingOff ).toBe( true );
	} );

	it( 'reads the level-forced flag and the forced percent once a level is dragged in', () => {
		expect( derived.devtoolsIsLevelForced ).toBe( false );

		mocks.state.devtools.battery.level = 0.42;
		expect( derived.devtoolsIsLevelForced ).toBe( true );
		expect( derived.devtoolsLevelPercent ).toBe( 42 );
		expect( derived.devtoolsLevelFillPercent ).toBe( '42%' );
	} );

	it( 'falls back to the published system percentage while following the system', () => {
		mocks.state.batterySystemPercent = 67;

		expect( derived.devtoolsIsLevelForced ).toBe( false );
		expect( derived.devtoolsLevelPercent ).toBe( 67 );
		expect( derived.devtoolsLevelFillPercent ).toBe( '67%' );
	} );

	it( 'live-updates the system-percent fallback as new readings are published', () => {
		mocks.state.batterySystemPercent = 67;
		expect( derived.devtoolsLevelPercent ).toBe( 67 );

		// A later reading arrives (the production battery seam publishes a new
		// value); the getter must reflect it immediately, not a stale snapshot.
		mocks.state.batterySystemPercent = 54;
		expect( derived.devtoolsLevelPercent ).toBe( 54 );
		expect( derived.devtoolsLevelFillPercent ).toBe( '54%' );
	} );

	it( 'a forced level wins over the published system percentage', () => {
		mocks.state.batterySystemPercent = 67;
		mocks.state.devtools.battery.level = 0.2;

		expect( derived.devtoolsLevelPercent ).toBe( 20 );
		expect( derived.devtoolsLevelFillPercent ).toBe( '20%' );
	} );

	it( 'falls back to 50 only when neither a forced level nor a system percentage exists', () => {
		mocks.state.batterySystemPercent = null;

		expect( derived.devtoolsLevelPercent ).toBe( 50 );
		expect( derived.devtoolsLevelFillPercent ).toBe( '50%' );
	} );

	it( 'is armed once any field diverges from system — there is no separate enable switch', () => {
		// Disarmed: both fields still follow the system.
		expect( derived.devtoolsIsArmed ).toBe( false );

		// A non-system charging choice arms it on its own.
		mocks.state.devtools.battery.charging = false;
		expect( derived.devtoolsIsArmed ).toBe( true );

		// Back to system...
		mocks.state.devtools.battery.charging = null;
		expect( derived.devtoolsIsArmed ).toBe( false );

		// ...but a dragged-in level alone also arms it.
		mocks.state.devtools.battery.level = 0.3;
		expect( derived.devtoolsIsArmed ).toBe( true );

		// Clearing the level back to system disarms it again.
		mocks.state.devtools.battery.level = null;
		expect( derived.devtoolsIsArmed ).toBe( false );
	} );
} );

describe( 'persistence', () => {
	it( 'writes the whole slice to localStorage on devtoolsPersist', () => {
		mocks.state.devtools = {
			open: true,
			battery: { charging: true, level: 0.2 },
		};

		callbacks.devtoolsPersist();

		const stored: unknown = JSON.parse(
			window.localStorage.getItem( DEVTOOLS_STORAGE_KEY ) ?? 'null'
		);
		expect( stored ).toEqual( {
			open: true,
			battery: { charging: true, level: 0.2 },
		} );
	} );

	it( 'hydrates the shared state from a previously persisted slice', () => {
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { charging: false, level: 0.6 },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools ).toEqual( {
			open: true,
			battery: { charging: false, level: 0.6 },
		} );
	} );

	it( 'leaves the default state untouched when nothing is stored', () => {
		hydrateDevtools();

		expect( mocks.state.devtools.open ).toBe( false );
	} );

	it( 'ignores a corrupted or stale-shape stored value', () => {
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( { nonsense: true } )
		);
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );

		window.localStorage.setItem( DEVTOOLS_STORAGE_KEY, '{not json' );
		hydrateDevtools();
		expect( mocks.state.devtools.open ).toBe( false );
	} );

	it( 'ignores a value stored under the old (pre-redesign) v1 key', () => {
		// The old shape carried a now-removed `enabled` flag under the old key.
		// The storage key bump means it is simply never looked up again — the
		// slice starts fresh at its defaults instead of inheriting a stale
		// `enabled` concept that no longer exists.
		window.localStorage.setItem(
			'bsb-devtools-v1',
			JSON.stringify( {
				open: true,
				battery: { enabled: true, charging: true, level: 0.9 },
			} )
		);

		hydrateDevtools();

		expect( DEVTOOLS_STORAGE_KEY ).toBe( 'bsb-devtools-v2' );
		expect( mocks.state.devtools ).toEqual( {
			open: false,
			battery: { charging: null, level: null },
		} );
	} );
} );
