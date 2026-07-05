/**
 * Tests for the discharge-simulation sub-tool slice: the ticker (via fake
 * timers), the Start/Stop action, the stepper actions, and resuming a sim
 * left running from a previous session.
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

import { dischargeSimStore, resumeDischargeSim } from './DischargeSimStore';

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
};

const defaultSim = (): MockSim => ( {
	fromPercent: 90,
	toPercent: 20,
	minutes: 30,
	running: false,
	startedAt: null,
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
	it( 'start forces discharging, seeds the level immediately, and begins ticking', () => {
		actions.devtoolsToggleSim();

		expect( mocks.state.devtools.sim.running ).toBe( true );
		expect( mocks.state.devtools.sim.startedAt ).toBe( Date.now() );
		expect( mocks.state.devtools.battery.charging ).toBe( false );
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.9 );

		vi.advanceTimersByTime( 1000 );

		expect( derived.devtoolsIsSimRunning ).toBe( true );
	} );

	it( 'the ticker interpolates the level as time passes', () => {
		// 90 → 20 over 10 minutes, ticking every second.
		mocks.state.devtools.sim.minutes = 10;
		actions.devtoolsToggleSim();

		vi.advanceTimersByTime( 5 * 60 * 1000 ); // halfway

		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.55 );
		expect( mocks.state.devtools.battery.charging ).toBe( false );
		expect( mocks.state.devtools.sim.running ).toBe( true );
	} );

	it( 'completion stops the ticker at the end level and clears running', () => {
		mocks.state.devtools.sim.minutes = 5;
		actions.devtoolsToggleSim();

		vi.advanceTimersByTime( 5 * 60 * 1000 + 1000 );

		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.2 );
		expect( mocks.state.devtools.sim.running ).toBe( false );

		// The ticker really stopped — further time must not change the level.
		mocks.state.devtools.battery.level = 0.2;
		vi.advanceTimersByTime( 60_000 );
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.2 );
	} );

	it( 'stop freezes the current overrides in place — no reset', () => {
		mocks.state.devtools.sim.minutes = 10;
		actions.devtoolsToggleSim();
		vi.advanceTimersByTime( 2 * 60 * 1000 );

		const levelWhenStopped = mocks.state.devtools.battery.level;
		actions.devtoolsToggleSim(); // Stop

		expect( mocks.state.devtools.sim.running ).toBe( false );
		expect( mocks.state.devtools.battery.level ).toBeCloseTo(
			levelWhenStopped as number
		);

		// No further ticking after stop.
		vi.advanceTimersByTime( 60_000 );
		expect( mocks.state.devtools.battery.level ).toBeCloseTo(
			levelWhenStopped as number
		);
	} );
} );

describe( 'resumeDischargeSim', () => {
	it( 'does nothing when the restored sim was not running', () => {
		resumeDischargeSim();
		expect( mocks.state.devtools.battery.level ).toBeNull();
	} );

	it( 'continues a mid-flight sim from its persisted startedAt', () => {
		const startedAt = Date.now() - 5 * 60 * 1000; // 5 minutes ago
		mocks.state.devtools.sim = {
			fromPercent: 90,
			toPercent: 20,
			minutes: 10,
			running: true,
			startedAt,
		};

		resumeDischargeSim();

		// Halfway through a 10-minute 90→20 run.
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.55 );
		expect( mocks.state.devtools.battery.charging ).toBe( false );
		expect( mocks.state.devtools.sim.running ).toBe( true );

		// And it keeps ticking from here.
		vi.advanceTimersByTime( 5 * 60 * 1000 );
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.2 );
		expect( mocks.state.devtools.sim.running ).toBe( false );
	} );

	it( 'freezes a sim whose end time already passed, and stops it', () => {
		const startedAt = Date.now() - 20 * 60 * 1000; // 20 minutes ago
		mocks.state.devtools.sim = {
			fromPercent: 90,
			toPercent: 20,
			minutes: 10, // ended 10 minutes ago
			running: true,
			startedAt,
		};

		resumeDischargeSim();

		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.2 );
		expect( mocks.state.devtools.battery.charging ).toBe( false );
		expect( mocks.state.devtools.sim.running ).toBe( false );

		// No ticker was started — the level must not keep changing.
		vi.advanceTimersByTime( 60_000 );
		expect( mocks.state.devtools.battery.level ).toBeCloseTo( 0.2 );
	} );
} );
