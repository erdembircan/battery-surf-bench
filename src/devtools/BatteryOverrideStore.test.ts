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
	enabled: boolean;
	charging: boolean | null;
	level: number | null;
}

interface DevtoolsState {
	open: boolean;
	battery: DevtoolsBatteryOverride;
}

const mocks = vi.hoisted( () => ( {
	state: undefined as unknown as { devtools: DevtoolsState },
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
	devtoolsToggleBatteryEnabled: () => void;
	devtoolsSetCharging: () => void;
	devtoolsToggleLevel: () => void;
	devtoolsSetLevel: () => void;
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
			battery: { enabled: false, charging: null, level: null },
		},
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

	it( 'toggles the battery sub-tool armed state', () => {
		actions.devtoolsToggleBatteryEnabled();
		expect( mocks.state.devtools.battery.enabled ).toBe( true );

		actions.devtoolsToggleBatteryEnabled();
		expect( mocks.state.devtools.battery.enabled ).toBe( false );
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

	it( 'arms the level override at a seeded value, then disarms it', () => {
		actions.devtoolsToggleLevel();
		expect( mocks.state.devtools.battery.level ).toBe( 0.5 );

		actions.devtoolsToggleLevel();
		expect( mocks.state.devtools.battery.level ).toBeNull();
	} );

	it( 'sets the level override from the triggering range input’s value', () => {
		mocks.element = { dataset: {}, value: '30' };

		actions.devtoolsSetLevel();

		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.3 );
	} );

	it( 'ignores a non-numeric range value', () => {
		mocks.element = { dataset: {}, value: 'not-a-number' };

		actions.devtoolsSetLevel();

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

	it( 'reads the level-forced flag and percent, defaulting to 50 when unarmed', () => {
		expect( derived.devtoolsIsLevelForced ).toBe( false );
		expect( derived.devtoolsLevelPercent ).toBe( 50 );
		expect( derived.devtoolsLevelFillPercent ).toBe( '50%' );

		mocks.state.devtools.battery.level = 0.42;
		expect( derived.devtoolsIsLevelForced ).toBe( true );
		expect( derived.devtoolsLevelPercent ).toBe( 42 );
		expect( derived.devtoolsLevelFillPercent ).toBe( '42%' );
	} );

	it( 'is armed only once enabled AND an override actually diverges from system', () => {
		// Disarmed: the sub-tool is off entirely.
		expect( derived.devtoolsIsArmed ).toBe( false );

		// Enabling alone is not armed — nothing is overridden yet (both fields
		// still follow the system).
		mocks.state.devtools.battery.enabled = true;
		expect( derived.devtoolsIsArmed ).toBe( false );

		// A non-system charging choice arms it.
		mocks.state.devtools.battery.charging = false;
		expect( derived.devtoolsIsArmed ).toBe( true );

		// Back to system, but a forced level alone also arms it.
		mocks.state.devtools.battery.charging = null;
		mocks.state.devtools.battery.level = 0.3;
		expect( derived.devtoolsIsArmed ).toBe( true );

		// Disabling the sub-tool overrides everything else back to unarmed.
		mocks.state.devtools.battery.enabled = false;
		expect( derived.devtoolsIsArmed ).toBe( false );
	} );
} );

describe( 'persistence', () => {
	it( 'writes the whole slice to localStorage on devtoolsPersist', () => {
		mocks.state.devtools = {
			open: true,
			battery: { enabled: true, charging: true, level: 0.2 },
		};

		callbacks.devtoolsPersist();

		const stored: unknown = JSON.parse(
			window.localStorage.getItem( DEVTOOLS_STORAGE_KEY ) ?? 'null'
		);
		expect( stored ).toEqual( {
			open: true,
			battery: { enabled: true, charging: true, level: 0.2 },
		} );
	} );

	it( 'hydrates the shared state from a previously persisted slice', () => {
		window.localStorage.setItem(
			DEVTOOLS_STORAGE_KEY,
			JSON.stringify( {
				open: true,
				battery: { enabled: true, charging: false, level: 0.6 },
			} )
		);

		hydrateDevtools();

		expect( mocks.state.devtools ).toEqual( {
			open: true,
			battery: { enabled: true, charging: false, level: 0.6 },
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
} );
