/**
 * Tests for the cockpit Interactivity store.
 *
 * The store's consumer is the block markup: the viewport iframe binds its `src`
 * to `state.currentSrc`, and the control deck binds its mode, duration, baseline,
 * speed and run controls to the rest of the store. These tests stub the
 * Interactivity runtime, capture the store definition the module registers, and
 * assert what those derive from (and do to) the per-instance context and the
 * element that triggered each action.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

interface CoursePage {
	slug: string;
	title: string;
	url: string;
}

interface CockpitContext {
	pages: CoursePage[];
	activeIndex: number;
	mode: 'duration' | 'targetDrop';
	durationMinutes: number;
	baseline: boolean;
	speed: number;
	running: boolean;
	compact: boolean;
	elapsed: number;
	theme: 'light' | 'dark';
	themePref: 'light' | 'dark' | 'system';
	targetPercent: number;
	batteryLevel: number | null;
	batteryCharging: boolean;
	rate10: number | null;
	rateSession: number | null;
	secondsToEmpty: number | null;
}

interface CockpitConfig {
	state: {
		currentSrc: string;
		isModeDuration: boolean;
		isModeTargetDrop: boolean;
		durationDisplay: string;
		targetDisplay: string;
		targetCap: number;
		targetColor: string;
		isSpeed1: boolean;
		isSpeed4: boolean;
		isSpeed10: boolean;
		runClock: string;
		batteryDisplay: string;
		batteryColor: string;
		isCharging: boolean;
		isIdle: boolean;
		isRunning: boolean;
		isCompact: boolean;
		isStartBlocked: boolean;
		rate10Display: string;
		rateSessionDisplay: string;
		timeToEmptyDisplay: string;
	};
	actions: {
		selectMode: () => void;
		stepDuration: () => void;
		targetPointerDown: ( event: PointerEvent ) => void;
		targetPointerMove: ( event: PointerEvent ) => void;
		targetPointerUp: () => void;
		targetKeyDown: ( event: KeyboardEvent ) => void;
		toggleBaseline: () => void;
		selectSpeed: () => void;
		toggleRun: () => void;
		toggleCompact: () => void;
		toggleTheme: () => void;
	};
	callbacks: {
		tick: () => () => void;
		initTheme: () => () => void;
		initBattery: () => () => void;
		syncRunPolling: () => void;
		rollDuration: () => void;
	};
}

/** A stand-in for the element that triggered an action. */
interface MockElement {
	dataset: Record< string, string >;
	checked: boolean;
	value: string;
	getBoundingClientRect?: () => { left: number; width: number };
	setPointerCapture?: ( pointerId: number ) => void;
}

const baseContext = (): CockpitContext => ( {
	pages: [],
	activeIndex: 0,
	mode: 'duration',
	durationMinutes: 30,
	baseline: false,
	speed: 1,
	running: false,
	compact: false,
	elapsed: 0,
	theme: 'light',
	themePref: 'system',
	targetPercent: 20,
	batteryLevel: null,
	batteryCharging: false,
	rate10: null,
	rateSession: null,
	secondsToEmpty: null,
} );

const mocks = vi.hoisted( () => ( {
	config: undefined as CockpitConfig | undefined,
	context: undefined as unknown as CockpitContext,
	element: { dataset: {}, checked: false, value: '' } as MockElement,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: ( _namespace: string, config: CockpitConfig ) => {
		mocks.config = config;
		return config;
	},
	getContext: () => mocks.context,
	getElement: () => ( { ref: mocks.element } ),
} ) );

import './view';

const page = ( n: string ): CoursePage => ( {
	slug: n,
	title: n.toUpperCase(),
	url: `https://example.test/${ n }`,
} );

/**
 * Sets the element the next action will read.
 *
 * @param dataset - The `data-*` attributes the action reads its value from.
 * @param checked - Whether the element is a checked checkbox.
 */
const trigger = (
	dataset: Record< string, string >,
	checked = false
): void => {
	mocks.element = { dataset, checked, value: '' };
};

/** Makes the triggering element a 100px-wide battery track at x=0. */
const battery = (): void => {
	mocks.element = {
		dataset: {},
		checked: false,
		value: '',
		getBoundingClientRect: () => ( { left: 0, width: 100 } ),
		setPointerCapture: () => undefined,
	};
};

/**
 * A pointer event at the given x within the battery.
 * @param clientX
 */
const pointer = ( clientX: number ): PointerEvent =>
	( { clientX, pointerId: 1 } ) as unknown as PointerEvent;

/**
 * A keydown event for the given key.
 * @param name
 */
const key = ( name: string ): KeyboardEvent =>
	( {
		key: name,
		preventDefault: () => undefined,
	} ) as unknown as KeyboardEvent;

beforeEach( () => {
	mocks.context = baseContext();
	mocks.element = { dataset: {}, checked: false, value: '' };
} );

describe( 'bsb/cockpit view store', () => {
	describe( 'viewport', () => {
		it( 'derives the viewport src from the active course page once running', () => {
			mocks.context.running = true;
			mocks.context.pages = [ page( 'article-1' ) ];

			expect( mocks.config?.state.currentSrc ).toBe(
				'https://example.test/article-1'
			);
		} );

		it( 'yields an empty src while idle, so pages do not load before a run', () => {
			mocks.context.running = false;
			mocks.context.pages = [ page( 'article-1' ) ];

			expect( mocks.config?.state.currentSrc ).toBe( '' );
		} );

		it( 'yields an empty src when there are no pages to surf', () => {
			mocks.context.running = true;

			expect( mocks.config?.state.currentSrc ).toBe( '' );
		} );

		it( 'tracks the active page index for the src', () => {
			mocks.context.running = true;
			mocks.context.pages = [ page( 'article-1' ), page( 'gallery' ) ];
			mocks.context.activeIndex = 1;

			expect( mocks.config?.state.currentSrc ).toBe(
				'https://example.test/gallery'
			);
		} );
	} );

	describe( 'mode', () => {
		it( 'reflects which mode is active', () => {
			expect( mocks.config?.state.isModeDuration ).toBe( true );
			expect( mocks.config?.state.isModeTargetDrop ).toBe( false );

			mocks.context.mode = 'targetDrop';
			expect( mocks.config?.state.isModeDuration ).toBe( false );
			expect( mocks.config?.state.isModeTargetDrop ).toBe( true );
		} );

		it( 'selects the mode named by the triggering control', () => {
			trigger( { mode: 'targetDrop' } );
			mocks.config?.actions.selectMode();

			expect( mocks.context.mode ).toBe( 'targetDrop' );
		} );

		it( 'ignores an unknown mode value', () => {
			trigger( { mode: 'nonsense' } );
			mocks.config?.actions.selectMode();

			expect( mocks.context.mode ).toBe( 'duration' );
		} );
	} );

	describe( 'duration', () => {
		it( 'reads the configured duration back as text', () => {
			expect( mocks.config?.state.durationDisplay ).toBe( '30' );
		} );

		it( 'steps the duration by the triggering control amount', () => {
			trigger( { step: '5' } );
			mocks.config?.actions.stepDuration();
			expect( mocks.context.durationMinutes ).toBe( 35 );

			trigger( { step: '-5' } );
			mocks.config?.actions.stepDuration();
			expect( mocks.context.durationMinutes ).toBe( 30 );
		} );

		it( 'clamps the duration to the supported range', () => {
			mocks.context.durationMinutes = 5;
			trigger( { step: '-5' } );
			mocks.config?.actions.stepDuration();
			expect( mocks.context.durationMinutes ).toBe( 5 );

			mocks.context.durationMinutes = 240;
			trigger( { step: '5' } );
			mocks.config?.actions.stepDuration();
			expect( mocks.context.durationMinutes ).toBe( 240 );
		} );

		it( 'rolls the odometer and collapses leading-zero wheels', () => {
			const strips = [ 0, 1, 2 ].map( () => ( {
				style: { transition: '', transform: '' },
			} ) );
			const wheels = [ 0, 1, 2 ].map( () => ( {
				classList: { toggle: vi.fn() },
				style: { transition: '' },
			} ) );
			mocks.element = {
				querySelectorAll: ( sel: string ) =>
					sel.includes( 'strip' ) ? strips : wheels,
			} as unknown as MockElement;

			// Two digits: hundreds collapsed, tens shown, and a transform seated.
			mocks.context.durationMinutes = 30;
			mocks.config?.callbacks.rollDuration();
			expect( strips[ 2 ].style.transform ).toContain( 'translateY' );
			expect( wheels[ 0 ].classList.toggle ).toHaveBeenCalledWith(
				'is-collapsed',
				true
			);
			expect( wheels[ 1 ].classList.toggle ).toHaveBeenCalledWith(
				'is-collapsed',
				false
			);

			// A single digit collapses the tens wheel too.
			mocks.context.durationMinutes = 5;
			mocks.config?.callbacks.rollDuration();
			expect( wheels[ 1 ].classList.toggle ).toHaveBeenLastCalledWith(
				'is-collapsed',
				true
			);

			// Three digits reveal every wheel.
			mocks.context.durationMinutes = 100;
			mocks.config?.callbacks.rollDuration();
			expect( wheels[ 0 ].classList.toggle ).toHaveBeenLastCalledWith(
				'is-collapsed',
				false
			);
		} );
	} );

	describe( 'target drop', () => {
		// Clear any leftover drag state from a prior test.
		beforeEach( () => mocks.config?.actions.targetPointerUp() );

		it( 'reads the target battery level back as a percentage', () => {
			expect( mocks.config?.state.targetDisplay ).toBe( '20%' );

			mocks.context.targetPercent = 65;
			expect( mocks.config?.state.targetDisplay ).toBe( '65%' );
		} );

		it( 'colours the fill green at high levels and red at low ones', () => {
			mocks.context.targetPercent = 90;
			expect( mocks.config?.state.targetColor ).toBe(
				'hsl(108, 72%, 45%)'
			);

			mocks.context.targetPercent = 10;
			expect( mocks.config?.state.targetColor ).toBe(
				'hsl(12, 72%, 45%)'
			);
		} );

		it( 'sets the target from a pointer press inside the battery', () => {
			battery();
			mocks.config?.actions.targetPointerDown( pointer( 40 ) );
			expect( mocks.context.targetPercent ).toBe( 40 );
		} );

		it( 'tracks the pointer only while dragging, and clamps', () => {
			battery();
			mocks.config?.actions.targetPointerDown( pointer( 10 ) );
			mocks.config?.actions.targetPointerMove( pointer( 80 ) );
			expect( mocks.context.targetPercent ).toBe( 80 );

			// Below the range clamps up to the minimum.
			mocks.config?.actions.targetPointerMove( pointer( -20 ) );
			expect( mocks.context.targetPercent ).toBe( 5 );

			// After release, further moves are ignored.
			mocks.config?.actions.targetPointerUp();
			mocks.config?.actions.targetPointerMove( pointer( 70 ) );
			expect( mocks.context.targetPercent ).toBe( 5 );
		} );

		it( 'adjusts the target with the keyboard', () => {
			mocks.context.targetPercent = 50;

			mocks.config?.actions.targetKeyDown( key( 'ArrowRight' ) );
			expect( mocks.context.targetPercent ).toBe( 55 );

			mocks.config?.actions.targetKeyDown( key( 'ArrowDown' ) );
			expect( mocks.context.targetPercent ).toBe( 50 );

			mocks.config?.actions.targetKeyDown( key( 'Home' ) );
			expect( mocks.context.targetPercent ).toBe( 5 );

			mocks.config?.actions.targetKeyDown( key( 'End' ) );
			expect( mocks.context.targetPercent ).toBe( 95 );
		} );

		it( 'caps the target at the current battery level', () => {
			// 84% battery → cap snapped down to the step grid (80).
			mocks.context.batteryLevel = 84;
			expect( mocks.config?.state.targetCap ).toBe( 80 );

			// Dragging to the very top stops at the cap, not the nominal max.
			battery();
			mocks.config?.actions.targetPointerDown( pointer( 100 ) );
			expect( mocks.context.targetPercent ).toBe( 80 );
			mocks.config?.actions.targetPointerUp();

			// End jumps to the cap too.
			mocks.context.targetPercent = 40;
			mocks.config?.actions.targetKeyDown( key( 'End' ) );
			expect( mocks.context.targetPercent ).toBe( 80 );
		} );
	} );

	describe( 'baseline', () => {
		it( 'mirrors the checkbox checked state', () => {
			trigger( {}, true );
			mocks.config?.actions.toggleBaseline();
			expect( mocks.context.baseline ).toBe( true );

			trigger( {}, false );
			mocks.config?.actions.toggleBaseline();
			expect( mocks.context.baseline ).toBe( false );
		} );
	} );

	describe( 'speed', () => {
		it( 'reflects which speed is active', () => {
			mocks.context.speed = 4;

			expect( mocks.config?.state.isSpeed1 ).toBe( false );
			expect( mocks.config?.state.isSpeed4 ).toBe( true );
			expect( mocks.config?.state.isSpeed10 ).toBe( false );
		} );

		it( 'selects the speed named by the triggering control', () => {
			trigger( { speed: '10' } );
			mocks.config?.actions.selectSpeed();

			expect( mocks.context.speed ).toBe( 10 );
		} );

		it( 'ignores an unsupported speed value', () => {
			trigger( { speed: '7' } );
			mocks.config?.actions.selectSpeed();

			expect( mocks.context.speed ).toBe( 1 );
		} );
	} );

	describe( 'run', () => {
		it( 'reflects whether a run is live', () => {
			expect( mocks.config?.state.isRunning ).toBe( false );
			expect( mocks.config?.state.isIdle ).toBe( true );

			mocks.context.running = true;
			expect( mocks.config?.state.isRunning ).toBe( true );
			expect( mocks.config?.state.isIdle ).toBe( false );
		} );

		it( 'starts a run, resetting the elapsed clock', () => {
			mocks.context.elapsed = 999;

			mocks.config?.actions.toggleRun();

			expect( mocks.context.running ).toBe( true );
			expect( mocks.context.elapsed ).toBe( 0 );
		} );

		it( 'stops a live run back to the idle state', () => {
			mocks.context.running = true;
			mocks.context.compact = true;

			mocks.config?.actions.toggleRun();

			expect( mocks.context.running ).toBe( false );
			// Leaving a run also drops the compact view.
			expect( mocks.context.compact ).toBe( false );
		} );

		it( 'toggles the compact view, but only counts while running', () => {
			expect( mocks.config?.state.isCompact ).toBe( false );

			mocks.config?.actions.toggleCompact();
			expect( mocks.context.compact ).toBe( true );
			// Compact only resolves true mid-run.
			expect( mocks.config?.state.isCompact ).toBe( false );

			mocks.context.running = true;
			expect( mocks.config?.state.isCompact ).toBe( true );

			mocks.config?.actions.toggleCompact();
			expect( mocks.config?.state.isCompact ).toBe( false );
		} );

		it( 'blocks starting while the device is plugged in', () => {
			mocks.context.batteryCharging = true;

			expect( mocks.config?.state.isStartBlocked ).toBe( true );

			mocks.config?.actions.toggleRun();

			expect( mocks.context.running ).toBe( false );
		} );

		it( 'is not start-blocked once a run is already live', () => {
			mocks.context.batteryCharging = true;
			mocks.context.running = true;

			// Charging only blocks *starting*, not a run that is already going
			// (that case is handled by the auto-stop on plug-in).
			expect( mocks.config?.state.isStartBlocked ).toBe( false );
		} );

		it( 'is not start-blocked on battery power', () => {
			mocks.context.batteryCharging = false;

			expect( mocks.config?.state.isStartBlocked ).toBe( false );
		} );
	} );

	describe( 'surfing indicator', () => {
		it( 'counts the duration down to zero in duration mode', () => {
			mocks.context.mode = 'duration';
			mocks.context.durationMinutes = 30;

			mocks.context.elapsed = 0;
			expect( mocks.config?.state.runClock ).toBe( '30:00' );

			mocks.context.elapsed = 75;
			expect( mocks.config?.state.runClock ).toBe( '28:45' );

			// Clamped at zero once the duration is reached.
			mocks.context.elapsed = 2000;
			expect( mocks.config?.state.runClock ).toBe( '00:00' );
		} );

		it( 'counts elapsed time up in target-drop mode', () => {
			mocks.context.mode = 'targetDrop';

			mocks.context.elapsed = 0;
			expect( mocks.config?.state.runClock ).toBe( '00:00' );

			mocks.context.elapsed = 75;
			expect( mocks.config?.state.runClock ).toBe( '01:15' );

			mocks.context.elapsed = 605;
			expect( mocks.config?.state.runClock ).toBe( '10:05' );
		} );

		it( 'ticks the clock once a second while running, until cleaned up', () => {
			vi.useFakeTimers();
			mocks.context.running = true;

			const cleanup = mocks.config!.callbacks.tick();
			vi.advanceTimersByTime( 3000 );
			expect( mocks.context.elapsed ).toBe( 3 );

			cleanup();
			vi.advanceTimersByTime( 5000 );
			expect( mocks.context.elapsed ).toBe( 3 );

			vi.useRealTimers();
		} );

		it( 'stops the run and restores the deck when the duration elapses', () => {
			vi.useFakeTimers();
			mocks.context.mode = 'duration';
			mocks.context.durationMinutes = 5;
			mocks.context.running = true;
			mocks.context.compact = true;
			// One second short of the five-minute duration.
			mocks.context.elapsed = 299;

			const cleanup = mocks.config!.callbacks.tick();
			vi.advanceTimersByTime( 1000 );

			// The countdown hit zero: the run ends, the compact pill closes, and
			// the deck (left dashboard) comes back.
			expect( mocks.context.running ).toBe( false );
			expect( mocks.context.compact ).toBe( false );

			// Once stopped, the clock no longer advances.
			vi.advanceTimersByTime( 5000 );
			expect( mocks.context.elapsed ).toBe( 300 );

			cleanup();
			vi.useRealTimers();
		} );

		it( 'keeps running past the clock in target-drop mode', () => {
			vi.useFakeTimers();
			mocks.context.mode = 'targetDrop';
			mocks.context.durationMinutes = 5;
			mocks.context.running = true;
			mocks.context.elapsed = 299;

			const cleanup = mocks.config!.callbacks.tick();
			vi.advanceTimersByTime( 2000 );

			// Target-drop has no fixed length, so the clock keeps climbing.
			expect( mocks.context.running ).toBe( true );
			expect( mocks.context.elapsed ).toBe( 301 );

			cleanup();
			vi.useRealTimers();
		} );

		it( 'holds the clock while idle so it stays at rest between runs', () => {
			vi.useFakeTimers();
			mocks.context.running = false;

			const cleanup = mocks.config!.callbacks.tick();
			vi.advanceTimersByTime( 4000 );
			expect( mocks.context.elapsed ).toBe( 0 );

			cleanup();
			vi.useRealTimers();
		} );
	} );

	describe( 'battery readouts', () => {
		afterEach( () => {
			delete ( navigator as { getBattery?: unknown } ).getBattery;
		} );

		it( 'reads the battery level and colour, idle by default', () => {
			expect( mocks.config?.state.batteryDisplay ).toBe( '—' );
			expect( mocks.config?.state.batteryColor ).toBe(
				'var(--text-soft)'
			);
			expect( mocks.config?.state.isCharging ).toBe( false );

			mocks.context.batteryLevel = 90;
			expect( mocks.config?.state.batteryDisplay ).toBe( '90' );
			expect( mocks.config?.state.batteryColor ).toBe(
				'hsl(108, 70%, 45%)'
			);

			mocks.context.batteryCharging = true;
			expect( mocks.config?.state.isCharging ).toBe( true );
		} );

		it( 'hides the readouts pill until a run is live', () => {
			expect( mocks.config?.state.isIdle ).toBe( true );

			mocks.context.running = true;
			expect( mocks.config?.state.isIdle ).toBe( false );
		} );

		it( 'shows em dashes for rates and time to empty until known', () => {
			expect( mocks.config?.state.rate10Display ).toBe( '—' );
			expect( mocks.config?.state.rateSessionDisplay ).toBe( '—' );
			expect( mocks.config?.state.timeToEmptyDisplay ).toBe( '—' );

			mocks.context.rate10 = 7.2;
			mocks.context.rateSession = 6.8;
			expect( mocks.config?.state.rate10Display ).toBe( '7.2' );
			expect( mocks.config?.state.rateSessionDisplay ).toBe( '6.8' );
		} );

		it( 'formats time to empty as H:MM', () => {
			mocks.context.secondsToEmpty = 32040;
			expect( mocks.config?.state.timeToEmptyDisplay ).toBe( '8:54' );

			mocks.context.secondsToEmpty = 0;
			expect( mocks.config?.state.timeToEmptyDisplay ).toBe( '—' );
		} );

		it( 'syncs level and charging from the Battery Status API', async () => {
			const mockBattery = {
				level: 0.42,
				charging: true,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			const cleanup = mocks.config!.callbacks.initBattery();

			await vi.waitFor( () =>
				expect( mocks.context.batteryLevel ).toBe( 42 )
			);
			expect( mocks.context.batteryCharging ).toBe( true );
			expect( mockBattery.addEventListener ).toHaveBeenCalledWith(
				'levelchange',
				expect.any( Function )
			);

			cleanup();
			expect( mockBattery.removeEventListener ).toHaveBeenCalledTimes(
				2
			);
		} );

		it( 'caps the seeded target down to the current battery level on read', async () => {
			const mockBattery = {
				level: 0.84,
				charging: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			// Seeded at the nominal max, as the render template does.
			mocks.context.targetPercent = 95;
			const cleanup = mocks.config!.callbacks.initBattery();

			await vi.waitFor( () =>
				expect( mocks.context.batteryLevel ).toBe( 84 )
			);
			// Defaulted to the current level, snapped to the step (80).
			expect( mocks.context.targetPercent ).toBe( 80 );

			cleanup();
		} );

		it( 'stops a live run when the device is plugged in mid-session', async () => {
			const mockBattery = {
				level: 0.5,
				charging: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			mocks.context.running = true;
			const cleanup = mocks.config!.callbacks.initBattery();

			await vi.waitFor( () =>
				expect( mockBattery.addEventListener ).toHaveBeenCalled()
			);

			// The charger goes in: the manager flips and notifies.
			const onChange = mockBattery.addEventListener.mock.calls.find(
				( call ) => call[ 0 ] === 'chargingchange'
			)?.[ 1 ] as () => void;
			mockBattery.charging = true;
			onChange();

			expect( mocks.context.batteryCharging ).toBe( true );
			expect( mocks.context.running ).toBe( false );

			cleanup();
		} );

		it( 'no-ops where the Battery Status API is unavailable', () => {
			const cleanup = mocks.config?.callbacks.initBattery();
			cleanup?.();

			expect( mocks.context.batteryLevel ).toBeNull();
		} );
	} );

	describe( 'drain-rate calculations', () => {
		afterEach( () => {
			delete ( navigator as { getBattery?: unknown } ).getBattery;
			vi.restoreAllMocks();
		} );

		/**
		 * Stubs `performance.now` to return the queued timestamps in order, so a
		 * run's samples land at known elapsed times.
		 * @param times
		 */
		const mockClock = ( times: number[] ): void => {
			const queue = [ ...times ];
			vi.spyOn( performance, 'now' ).mockImplementation(
				() => queue.shift() ?? times[ times.length - 1 ] ?? 0
			);
		};

		it( 'derives the rates and projection from samples taken during a run', async () => {
			// start → first reading → stepped reading, ten minutes apart.
			mockClock( [ 0, 0, 600_000 ] );
			const mockBattery = {
				level: 0.8,
				charging: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			mocks.config!.actions.toggleRun();
			expect( mocks.context.running ).toBe( true );

			const cleanup = mocks.config!.callbacks.initBattery();
			await vi.waitFor( () =>
				expect( mockBattery.addEventListener ).toHaveBeenCalled()
			);

			// The battery steps down 1% over the ten minutes since start.
			const onChange = mockBattery.addEventListener.mock.calls.find(
				( call ) => call[ 0 ] === 'levelchange'
			)?.[ 1 ] as () => void;
			mockBattery.level = 0.79;
			onChange();

			// 1% over 10 min → 6 %/h; from 79% to empty at 6 %/h → 47,400 s.
			expect( mocks.context.rateSession ).toBe( 6 );
			expect( mocks.context.rate10 ).toBe( 6 );
			expect( mocks.context.secondsToEmpty ).toBe( 47_400 );

			cleanup();
		} );

		it( 'clears stale readouts when a fresh run starts', () => {
			mockClock( [ 0 ] );
			mocks.context.rate10 = 9;
			mocks.context.rateSession = 9;
			mocks.context.secondsToEmpty = 1_000;

			mocks.config!.actions.toggleRun();

			expect( mocks.context.rate10 ).toBeNull();
			expect( mocks.context.rateSession ).toBeNull();
			expect( mocks.context.secondsToEmpty ).toBeNull();
		} );

		it( 'normalizes a tampered duration when a run starts', () => {
			mockClock( [ 0 ] );
			// A crafted context tries to stretch the run past the ceiling.
			mocks.context.durationMinutes = 300;

			mocks.config!.actions.toggleRun();

			expect( mocks.context.durationMinutes ).toBe( 240 );
		} );

		it( 'stops sampling once the device is plugged in mid-run', async () => {
			mockClock( [ 0, 0, 300_000, 600_000 ] );
			const mockBattery = {
				level: 0.8,
				charging: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			mocks.config!.actions.toggleRun();
			const cleanup = mocks.config!.callbacks.initBattery();
			await vi.waitFor( () =>
				expect( mockBattery.addEventListener ).toHaveBeenCalled()
			);

			const handlers = ( type: string ): ( () => void ) =>
				mockBattery.addEventListener.mock.calls.find(
					( call ) => call[ 0 ] === type
				)?.[ 1 ] as () => void;

			// The charger goes in: the run ends and sampling stops.
			mockBattery.charging = true;
			handlers( 'chargingchange' )();
			expect( mocks.context.running ).toBe( false );

			// A later reading while plugged in does not resume the calculations.
			mockBattery.level = 0.5;
			handlers( 'levelchange' )();
			expect( mocks.context.rateSession ).toBeNull();

			cleanup();
		} );

		it( 'runs the battery heartbeat poll only while a run is live', async () => {
			const setSpy = vi.spyOn( window, 'setInterval' );
			const clearSpy = vi.spyOn( window, 'clearInterval' );
			const mockBattery = {
				level: 0.8,
				charging: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			const cleanup = mocks.config!.callbacks.initBattery();
			await vi.waitFor( () =>
				expect( mockBattery.addEventListener ).toHaveBeenCalled()
			);

			// Only the 30s heartbeat poll, isolated from any other interval.
			const heartbeats = (): unknown[] =>
				setSpy.mock.calls.filter( ( call ) => call[ 1 ] === 30_000 );

			// Idle: the watch keeps the poll at rest.
			mocks.context.running = false;
			mocks.config!.callbacks.syncRunPolling();
			expect( heartbeats() ).toHaveLength( 0 );

			// Run live: the watch starts the poll at the 30s cadence.
			mocks.context.running = true;
			mocks.config!.callbacks.syncRunPolling();
			expect( heartbeats() ).toHaveLength( 1 );
			const beatIndex = setSpy.mock.calls.findIndex(
				( call ) => call[ 1 ] === 30_000
			);
			const beatId = setSpy.mock.results[ beatIndex ]!.value;

			// The poll is idempotent while the run continues (no second timer).
			mocks.config!.callbacks.syncRunPolling();
			expect( heartbeats() ).toHaveLength( 1 );

			// Run ends — by any cause that flips `running` — and the poll stops.
			mocks.context.running = false;
			mocks.config!.callbacks.syncRunPolling();
			expect( clearSpy ).toHaveBeenCalledWith( beatId );

			cleanup();
		} );
	} );

	describe( 'theme', () => {
		beforeEach( () => {
			window.localStorage.clear();
		} );

		afterEach( () => {
			delete ( window as { matchMedia?: unknown } ).matchMedia;
		} );

		/**
		 * Stubs `prefers-color-scheme: dark` and lets a test flip it live.
		 * @param matches
		 */
		const mockOsDark = ( matches: boolean ) => {
			const listeners = new Set< () => void >();
			const mql = {
				matches,
				addEventListener: ( _type: string, cb: () => void ) =>
					listeners.add( cb ),
				removeEventListener: ( _type: string, cb: () => void ) =>
					listeners.delete( cb ),
				flip: ( next: boolean ) => {
					mql.matches = next;
					listeners.forEach( ( cb ) => cb() );
				},
			};
			( window as { matchMedia?: unknown } ).matchMedia = () => mql;

			return mql;
		};

		it( 'cycles system → light → dark and remembers the preference', () => {
			// The seeded preference is "system"; with no OS dark, it resolves light.
			mocks.config?.actions.toggleTheme();
			expect( mocks.context.themePref ).toBe( 'light' );
			expect( mocks.context.theme ).toBe( 'light' );
			expect( window.localStorage.getItem( 'bsb-cockpit-theme' ) ).toBe(
				'light'
			);

			mocks.config?.actions.toggleTheme();
			expect( mocks.context.themePref ).toBe( 'dark' );
			expect( mocks.context.theme ).toBe( 'dark' );

			mocks.config?.actions.toggleTheme();
			expect( mocks.context.themePref ).toBe( 'system' );
			expect( window.localStorage.getItem( 'bsb-cockpit-theme' ) ).toBe(
				'system'
			);
		} );

		it( 'restores a remembered fixed preference on init', () => {
			window.localStorage.setItem( 'bsb-cockpit-theme', 'dark' );

			mocks.config?.callbacks.initTheme();

			expect( mocks.context.themePref ).toBe( 'dark' );
			expect( mocks.context.theme ).toBe( 'dark' );
		} );

		it( 'defaults to following the system when nothing is remembered', () => {
			mocks.config?.callbacks.initTheme();

			expect( mocks.context.themePref ).toBe( 'system' );
			expect( mocks.context.theme ).toBe( 'light' );
		} );

		it( 'resolves the system preference to the OS dark scheme', () => {
			mockOsDark( true );

			mocks.config?.callbacks.initTheme();

			expect( mocks.context.themePref ).toBe( 'system' );
			expect( mocks.context.theme ).toBe( 'dark' );
		} );

		it( 'lets a fixed preference override the OS', () => {
			mockOsDark( true );
			window.localStorage.setItem( 'bsb-cockpit-theme', 'light' );

			mocks.config?.callbacks.initTheme();

			expect( mocks.context.themePref ).toBe( 'light' );
			expect( mocks.context.theme ).toBe( 'light' );
		} );

		it( 're-applies on OS change while on system, until cleaned up', () => {
			const mql = mockOsDark( false );

			const cleanup = mocks.config!.callbacks.initTheme();
			expect( mocks.context.theme ).toBe( 'light' );

			mql.flip( true );
			expect( mocks.context.theme ).toBe( 'dark' );

			cleanup();
			mql.flip( false );
			expect( mocks.context.theme ).toBe( 'dark' );
		} );
	} );
} );
