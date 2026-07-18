/**
 * Tests for the discharge-simulation sub-tool slice: the ticker (via fake
 * timers), the Start/Stop action, and the stepper actions.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

/** A stand-in for the element that triggered a stepper action. */
interface MockElement {
	dataset: Record< string, string >;
}

interface MockSim {
	fromPercent: number;
	toPercent: number;
	minutes: number;
	running: boolean;
	startedAt: number | null;
	currentLevel: number | null;
	remainingMs: number | null;
}

interface MockDevtoolsState {
	open: boolean;
	battery: { charging: boolean | null; level: number | null };
	sim: MockSim;
}

const mocks = vi.hoisted( () => ( {
	state: undefined as unknown as { devtools: MockDevtoolsState },
	element: { dataset: {} } as MockElement,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: () => ( { state: mocks.state } ),
	getElement: () => ( { ref: mocks.element } ),
} ) );

import { dischargeSimStore } from '@/devtools/store/DischargeSimStore';

const actions = dischargeSimStore.actions as unknown as {
	devtoolsStepSim: () => void;
	devtoolsToggleSim: () => void;
};
const derived = dischargeSimStore.state as unknown as {
	devtoolsSimFromDisplay: string;
	devtoolsSimToDisplay: string;
	devtoolsSimMinutesDisplay: string;
	devtoolsIsSimRunning: boolean;
	devtoolsIsSimStartBlocked: boolean;
	devtoolsSimRemainingDisplay: string;
};

const defaultSim = (): MockSim => ( {
	fromPercent: 90,
	toPercent: 20,
	minutes: 30,
	running: false,
	startedAt: null,
	currentLevel: null,
	remainingMs: null,
} );

const step = ( field: string, amount: number ): void => {
	mocks.element = {
		dataset: { devtoolsSimField: field, step: String( amount ) },
	};
	actions.devtoolsStepSim();
};

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
	mocks.element = { dataset: {} };
} );

afterEach( () => {
	// Stop any ticker a test left running so it cannot leak into the next one.
	if ( mocks.state.devtools.sim.running ) {
		actions.devtoolsToggleSim();
	}
	vi.useRealTimers();
} );

describe( 'stepper actions', () => {
	it( 'steps and clamps the From percentage to 0–100', () => {
		step( 'from', -5 );
		expect( mocks.state.devtools.sim.fromPercent ).toBe( 85 );

		mocks.state.devtools.sim.fromPercent = 2;
		step( 'from', -5 );
		expect( mocks.state.devtools.sim.fromPercent ).toBe( 0 );

		mocks.state.devtools.sim.fromPercent = 98;
		step( 'from', 5 );
		expect( mocks.state.devtools.sim.fromPercent ).toBe( 100 );
	} );

	it( 'steps and clamps the To percentage to 0–100', () => {
		step( 'to', 5 );
		expect( mocks.state.devtools.sim.toPercent ).toBe( 25 );
	} );

	it( 'steps and clamps the duration to 5–60 minutes', () => {
		step( 'minutes', 5 );
		expect( mocks.state.devtools.sim.minutes ).toBe( 35 );

		mocks.state.devtools.sim.minutes = 6;
		step( 'minutes', -5 );
		expect( mocks.state.devtools.sim.minutes ).toBe( 5 );

		mocks.state.devtools.sim.minutes = 58;
		step( 'minutes', 5 );
		expect( mocks.state.devtools.sim.minutes ).toBe( 60 );
	} );

	it( 'is a no-op while the sim is running', () => {
		mocks.state.devtools.sim.running = true;
		step( 'from', -5 );
		expect( mocks.state.devtools.sim.fromPercent ).toBe( 90 );
	} );

	it( 'displays the config fields as text', () => {
		expect( derived.devtoolsSimFromDisplay ).toBe( '90' );
		expect( derived.devtoolsSimToDisplay ).toBe( '20' );
		expect( derived.devtoolsSimMinutesDisplay ).toBe( '30' );
	} );
} );

describe( 'the Start-guard', () => {
	it( 'blocks starting when the end is not below the start', () => {
		mocks.state.devtools.sim.fromPercent = 50;
		mocks.state.devtools.sim.toPercent = 50;
		expect( derived.devtoolsIsSimStartBlocked ).toBe( true );

		actions.devtoolsToggleSim();
		expect( mocks.state.devtools.sim.running ).toBe( false );
	} );

	it( 'never blocks stopping once running', () => {
		mocks.state.devtools.sim.fromPercent = 90;
		mocks.state.devtools.sim.toPercent = 20;
		actions.devtoolsToggleSim();
		expect( mocks.state.devtools.sim.running ).toBe( true );

		expect( derived.devtoolsIsSimStartBlocked ).toBe( false );
	} );

	it( 'allows starting once the end is below the start', () => {
		expect( derived.devtoolsIsSimStartBlocked ).toBe( false );
	} );
} );

describe( 'starting and ticking', () => {
	it( 'start seeds the sim’s own currentLevel immediately, begins ticking, and never touches the manual battery layer', () => {
		actions.devtoolsToggleSim();

		expect( mocks.state.devtools.sim.running ).toBe( true );
		expect( mocks.state.devtools.sim.startedAt ).toBe( Date.now() );
		expect( mocks.state.devtools.sim.currentLevel ).toBeCloseTo( 0.9 );
		expect( mocks.state.devtools.battery.charging ).toBeNull();
		expect( mocks.state.devtools.battery.level ).toBeNull();

		vi.advanceTimersByTime( 1000 );

		expect( derived.devtoolsIsSimRunning ).toBe( true );
	} );

	it( 'the ticker interpolates sim.currentLevel as time passes, without writing to battery', () => {
		// 90 → 20 over 10 minutes, ticking every second.
		mocks.state.devtools.sim.minutes = 10;
		actions.devtoolsToggleSim();

		vi.advanceTimersByTime( 5 * 60 * 1000 ); // halfway

		expect( mocks.state.devtools.sim.currentLevel ).toBeCloseTo( 0.55 );
		expect( mocks.state.devtools.sim.running ).toBe( true );
		expect( mocks.state.devtools.battery.charging ).toBeNull();
		expect( mocks.state.devtools.battery.level ).toBeNull();
	} );

	it( 'tick never mutates state.battery, even across a full run', () => {
		mocks.state.devtools.sim.minutes = 5;
		actions.devtoolsToggleSim();

		for ( let i = 0; i < 5 * 60; i++ ) {
			vi.advanceTimersByTime( 1000 );
			expect( mocks.state.devtools.battery ).toEqual( {
				charging: null,
				level: null,
			} );
		}
	} );

	it( 'completion clears running and reverts — currentLevel back to null, no frozen level left behind', () => {
		mocks.state.devtools.sim.minutes = 5;
		actions.devtoolsToggleSim();

		vi.advanceTimersByTime( 5 * 60 * 1000 + 1000 );

		expect( mocks.state.devtools.sim.running ).toBe( false );
		expect( mocks.state.devtools.sim.currentLevel ).toBeNull();
		expect( mocks.state.devtools.battery.level ).toBeNull();

		// The ticker really stopped — further time must not resurrect a level.
		vi.advanceTimersByTime( 60_000 );
		expect( mocks.state.devtools.sim.currentLevel ).toBeNull();
	} );

	it( 'stop reverts — manual battery layer untouched by start/tick/stop', () => {
		mocks.state.devtools.sim.minutes = 10;
		actions.devtoolsToggleSim();
		vi.advanceTimersByTime( 2 * 60 * 1000 );

		expect( mocks.state.devtools.sim.currentLevel ).not.toBeNull();

		actions.devtoolsToggleSim(); // Stop

		expect( mocks.state.devtools.sim.running ).toBe( false );
		expect( mocks.state.devtools.sim.currentLevel ).toBeNull();
		// The manual layer was never armed to begin with — stopping reverts to
		// exactly that, not to a level frozen from the run.
		expect( mocks.state.devtools.battery ).toEqual( {
			charging: null,
			level: null,
		} );

		// No further ticking after stop.
		vi.advanceTimersByTime( 60_000 );
		expect( mocks.state.devtools.sim.currentLevel ).toBeNull();
	} );

	it( 'a pre-existing manual override survives start → tick → stop unchanged', () => {
		mocks.state.devtools.battery = { charging: true, level: 0.55 };
		mocks.state.devtools.sim.minutes = 10;

		actions.devtoolsToggleSim(); // Start
		vi.advanceTimersByTime( 3 * 60 * 1000 );
		actions.devtoolsToggleSim(); // Stop

		expect( mocks.state.devtools.battery ).toEqual( {
			charging: true,
			level: 0.55,
		} );
	} );
} );

describe( 'remaining time', () => {
	it( 'start seeds remainingMs at the full duration and displays it immediately', () => {
		mocks.state.devtools.sim.minutes = 30;
		actions.devtoolsToggleSim();

		expect( mocks.state.devtools.sim.remainingMs ).toBe( 30 * 60 * 1000 );
		expect( derived.devtoolsSimRemainingDisplay ).toBe( '30:00' );
	} );

	it( 'the ticker counts remainingMs down as time passes', () => {
		mocks.state.devtools.sim.minutes = 10;
		actions.devtoolsToggleSim();

		vi.advanceTimersByTime( 5 * 60 * 1000 ); // halfway

		expect( mocks.state.devtools.sim.remainingMs ).toBe( 5 * 60 * 1000 );
		expect( derived.devtoolsSimRemainingDisplay ).toBe( '05:00' );
		// Never mutates the manual battery layer.
		expect( mocks.state.devtools.battery ).toEqual( {
			charging: null,
			level: null,
		} );
	} );

	it( 'completion clears remainingMs to null and the display reads 00:00 safely', () => {
		mocks.state.devtools.sim.minutes = 5;
		actions.devtoolsToggleSim();

		vi.advanceTimersByTime( 5 * 60 * 1000 + 1000 );

		expect( mocks.state.devtools.sim.running ).toBe( false );
		expect( mocks.state.devtools.sim.remainingMs ).toBeNull();
		expect( derived.devtoolsSimRemainingDisplay ).toBe( '00:00' );
	} );

	it( 'stop mid-run clears remainingMs to null', () => {
		mocks.state.devtools.sim.minutes = 10;
		actions.devtoolsToggleSim(); // Start
		vi.advanceTimersByTime( 2 * 60 * 1000 );

		expect( mocks.state.devtools.sim.remainingMs ).not.toBeNull();

		actions.devtoolsToggleSim(); // Stop

		expect( mocks.state.devtools.sim.remainingMs ).toBeNull();
		expect( derived.devtoolsSimRemainingDisplay ).toBe( '00:00' );
	} );
} );
