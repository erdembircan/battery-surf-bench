/**
 * Tests for the cockpit Interactivity store.
 *
 * The store's consumer is the block markup: the viewport iframe binds its `src`
 * to `state.currentSrc`, and the control deck binds its mode, duration, speed
 * and run controls to the rest of the store. These tests stub the
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
	speed: number;
	running: boolean;
	compact: boolean;
	soundEnabled: boolean;
	elapsed: number;
	targetPercent: number;
	batteryLevel: number | null;
	batteryCharging: boolean;
	batterySupported: boolean;
	rate10: number | null;
	rateSession: number | null;
	secondsToEmpty: number | null;
	ended: boolean;
	endReason: '' | 'duration' | 'targetDrop' | 'stopped' | 'plugged';
	flipped: boolean;
	idleFlipped: boolean;
	detailSamples?: { t: number; level: number; charging: boolean }[];
	reasonText: Record<
		string,
		{ head: string; sig: string; arc: string; unit: string }
	>;
	summaryBatteryStart: string;
	summaryBatteryEnd: string;
	summaryDropped: string;
	hasGraph: boolean;
	graphJson: string;
	toastKind: '' | 'error' | 'notice';
	toastText: string;
	toastPhase: '' | 'entering' | 'holding' | 'leaving';
	toastStrings: { error: string; notice: string };
}

interface CockpitConfig {
	state: {
		hasGraph: boolean;
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
		isBatteryUnsupported: boolean;
		// Production-owned: the raw system percentage published for the
		// dev-tools panel's level row, which has no cockpit context of its own.
		batterySystemPercent: number | null;
		isIdle: boolean;
		isRunning: boolean;
		isIdleFlipped: boolean;
		isDeckShown: boolean;
		isCompact: boolean;
		isStartBlocked: boolean;
		rate10Display: string;
		rateSessionDisplay: string;
		timeToEmptyDisplay: string;
		isEnded: boolean;
		isFlipped: boolean;
		isReasonDuration: boolean;
		isReasonTargetDrop: boolean;
		isReasonStopped: boolean;
		isReasonPlugged: boolean;
		summaryHeading: string;
		summarySig: string;
		summaryElapsed: string;
		isSoundOn: boolean;
		hasToast: boolean;
		isToastError: boolean;
		isToastNotice: boolean;
		toastMessage: string;
		toastRole: string;
		isToastEntering: boolean;
		isToastHolding: boolean;
		isToastLeaving: boolean;
		// Present only once the dev-tools module has joined the store (never set
		// by this file's own registration); the battery seam reads it optionally.
		devtools?: {
			battery: {
				charging: boolean | null;
				level: number | null;
			};
		};
	};
	actions: {
		selectMode: () => void;
		stepDuration: () => void;
		targetPointerDown: ( event: PointerEvent ) => void;
		targetPointerMove: ( event: PointerEvent ) => void;
		targetPointerUp: () => void;
		targetKeyDown: ( event: KeyboardEvent ) => void;
		selectSpeed: () => void;
		toggleRun: () => void;
		toggleCompact: () => void;
		toggleSound: () => void;
		toggleFlip: () => void;
		toggleIdleFlip: () => void;
		newRun: () => void;
		dismissToast: () => void;
		viewportEnter: () => void;
	};
	callbacks: {
		initBattery: () => () => void;
		syncBatteryOverride: () => void;
		initWakeLock: () => () => void;
		initSound: () => void;
		syncRunActivity: () => void;
		rollDuration: () => void;
		renderSummary: () => void;
		onToastAnimationEnd: () => void;
		initDetail: () => void;
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
	speed: 1,
	running: false,
	compact: false,
	soundEnabled: true,
	elapsed: 0,
	targetPercent: 20,
	batteryLevel: null,
	batteryCharging: false,
	batterySupported: true,
	rate10: null,
	rateSession: null,
	secondsToEmpty: null,
	ended: false,
	endReason: '',
	flipped: false,
	idleFlipped: false,
	reasonText: {},
	summaryBatteryStart: '',
	summaryBatteryEnd: '',
	summaryDropped: '',
	hasGraph: false,
	graphJson: '',
	toastKind: '',
	toastText: '',
	toastPhase: '',
	toastStrings: { error: 'Upload failed', notice: 'View only' },
} );

const mocks = vi.hoisted( () => ( {
	config: undefined as CockpitConfig | undefined,
	context: undefined as unknown as CockpitContext,
	element: { dataset: {}, checked: false, value: '' } as MockElement,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	// The real `store()` returns the existing merged store when called with no
	// second argument (used by the battery seam to re-fetch the shared state for
	// the dev-tools override) — only overwrite the captured config when one is
	// actually supplied, so that re-fetch reads back the same config instead of
	// wiping it.
	store: ( _namespace: string, config?: CockpitConfig ) => {
		if ( config !== undefined ) {
			mocks.config = config;
		}
		return mocks.config;
	},
	getContext: () => mocks.context,
	getElement: () => ( { ref: mocks.element } ),
	// The end-of-run upload reads its REST access through `getConfig`; returning
	// an empty config makes the upload a no-op here, so these store tests never
	// reach the network while ending a run.
	getConfig: () => ( {} ),
} ) );

import { __resetInstance } from './view';

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
	// The run state is a module singleton; reset it so tests stay isolated.
	__resetInstance();
	// `mocks.config` (and its `state`) is the one real merged store, captured
	// once at module load and shared by every test in this file — clear any
	// dev-tools override (and the published system percentage) a prior test
	// left on it, so neither leaks across tests the way `mocks.context`
	// cannot (that one is rebuilt above).
	delete mocks.config?.state.devtools;
	if ( mocks.config ) {
		mocks.config.state.batterySystemPercent = null;
	}
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

		it( 'starts a run, resetting the run-scoped state', () => {
			mocks.context.elapsed = 999;
			// A run opens in the compact view regardless of the prior state.
			mocks.context.compact = false;

			mocks.config?.actions.toggleRun();

			expect( mocks.context.running ).toBe( true );
			expect( mocks.context.elapsed ).toBe( 0 );
			expect( mocks.context.compact ).toBe( true );
		} );

		it( 'stops a live run back to the idle state', () => {
			mocks.context.running = true;
			mocks.context.compact = true;

			mocks.config?.actions.toggleRun();

			expect( mocks.context.running ).toBe( false );
			// Leaving a run drops the compact view: isCompact derives false once
			// the run is no longer live.
			expect( mocks.config?.state.isCompact ).toBe( false );
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

		it( 'refuses to start where the Battery Status API is unsupported', () => {
			// The deck is locked away when unsupported, but the action is guarded
			// too: a forced or tampered call must not start a run with no battery
			// data to measure.
			mocks.context.batterySupported = false;

			mocks.config?.actions.toggleRun();

			expect( mocks.context.running ).toBe( false );
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

		it( 'runs the clock once a second while a run is live, and stops with it', () => {
			vi.useFakeTimers();
			mocks.context.running = true;

			// The watch starts the clock when the run goes live.
			mocks.config!.callbacks.syncRunActivity();
			vi.advanceTimersByTime( 3000 );
			expect( mocks.context.elapsed ).toBe( 3 );

			// The run ends; the watch reacts to `running` and stops the clock.
			mocks.context.running = false;
			mocks.config!.callbacks.syncRunActivity();
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

			mocks.config!.callbacks.syncRunActivity();
			vi.advanceTimersByTime( 1000 );

			// The countdown hit zero: the run ends and the deck comes back — the
			// compact pill closes because `isCompact` derives false once stopped.
			expect( mocks.context.running ).toBe( false );
			expect( mocks.config?.state.isCompact ).toBe( false );
			expect( mocks.context.endReason ).toBe( 'duration' );

			// The watch reacts to the run ending and stops the clock.
			mocks.config!.callbacks.syncRunActivity();
			vi.advanceTimersByTime( 5000 );
			expect( mocks.context.elapsed ).toBe( 300 );

			vi.useRealTimers();
		} );

		it( 'keeps running past the clock in target-drop mode', () => {
			vi.useFakeTimers();
			mocks.context.mode = 'targetDrop';
			mocks.context.durationMinutes = 5;
			mocks.context.running = true;
			mocks.context.elapsed = 299;

			mocks.config!.callbacks.syncRunActivity();
			vi.advanceTimersByTime( 2000 );

			// Target-drop has no fixed length, so the clock keeps climbing.
			expect( mocks.context.running ).toBe( true );
			expect( mocks.context.elapsed ).toBe( 301 );

			mocks.context.running = false;
			mocks.config!.callbacks.syncRunActivity();
			vi.useRealTimers();
		} );

		it( 'holds the clock while idle so it stays at rest between runs', () => {
			vi.useFakeTimers();
			mocks.context.running = false;

			// Idle: the watch never starts a clock.
			mocks.config!.callbacks.syncRunActivity();
			vi.advanceTimersByTime( 4000 );
			expect( mocks.context.elapsed ).toBe( 0 );

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
			// The raw system percentage is published for the dev-tools panel's
			// level row (which has no cockpit context of its own) — the same
			// figure as the readout, independent of any override.
			expect( mocks.config?.state.batterySystemPercent ).toBe( 42 );

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

		it( 'flags the cockpit unsupported where the Battery Status API is unavailable', () => {
			// Supported by default so a normal browser is never locked.
			expect( mocks.config?.state.isBatteryUnsupported ).toBe( false );

			const cleanup = mocks.config?.callbacks.initBattery();
			cleanup?.();

			expect( mocks.context.batteryLevel ).toBeNull();
			// No API → flag unsupported so the view locks the cockpit.
			expect( mocks.context.batterySupported ).toBe( false );
			expect( mocks.config?.state.isBatteryUnsupported ).toBe( true );
		} );

		describe( 'dev-tools battery override', () => {
			/** The battery-override slice, as the devtools module would shape it. */
			type Override = {
				charging: boolean | null;
				level: number | null;
			};

			/**
			 * Arms the dev-tools override on the merged state, as the devtools
			 * module would. There is no separate "enabled" switch — each field's
			 * own `null` is its off-state, so a field being set is what puts an
			 * override in effect.
			 *
			 * @param override The battery-override slice to set.
			 */
			const setOverride = ( override: Override ): void => {
				mocks.config!.state.devtools = { battery: override };
			};

			it( 'forces charging through the override, stopping a live run despite a discharging reading', async () => {
				const mockBattery = {
					level: 0.5,
					charging: false,
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
				};
				( navigator as { getBattery?: unknown } ).getBattery = () =>
					Promise.resolve( mockBattery );

				mocks.context.running = true;
				setOverride( { charging: true, level: null } );

				const cleanup = mocks.config!.callbacks.initBattery();

				await vi.waitFor( () =>
					expect( mocks.context.batteryCharging ).toBe( true )
				);
				expect( mocks.context.running ).toBe( false );

				cleanup();
			} );

			it( 'leaves the reading untouched when neither field is set (production passthrough)', async () => {
				const mockBattery = {
					level: 0.5,
					charging: false,
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
				};
				( navigator as { getBattery?: unknown } ).getBattery = () =>
					Promise.resolve( mockBattery );

				setOverride( { charging: null, level: null } );

				const cleanup = mocks.config!.callbacks.initBattery();

				await vi.waitFor( () =>
					expect( mocks.context.batteryLevel ).toBe( 50 )
				);
				expect( mocks.context.batteryCharging ).toBe( false );

				cleanup();
			} );

			it( 're-applies the reading via syncBatteryOverride once the override changes mid-run', async () => {
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
					expect( mocks.context.batteryLevel ).toBe( 50 )
				);
				expect( mocks.context.running ).toBe( true );

				// Arming the override after the fact is what the
				// `data-wp-watch--devtools-battery` directive re-runs on.
				setOverride( { charging: true, level: null } );
				mocks.config!.callbacks.syncBatteryOverride();

				expect( mocks.context.batteryCharging ).toBe( true );
				expect( mocks.context.running ).toBe( false );

				cleanup();
			} );

			it( 'synthesizes a reading when the Battery Status API is unsupported but both override fields are set', () => {
				setOverride( { charging: false, level: 0.3 } );

				mocks.config!.callbacks.initBattery();

				// Unlocked despite the missing API, because the override supplied a
				// full reading.
				expect( mocks.config!.state.isBatteryUnsupported ).toBe(
					false
				);
				expect( mocks.context.batteryLevel ).toBe( 30 );
				expect( mocks.context.batteryCharging ).toBe( false );
			} );

			it( 'stays unsupported when the API is missing and the override is incomplete', () => {
				setOverride( { charging: true, level: null } );

				mocks.config!.callbacks.initBattery();

				expect( mocks.config!.state.isBatteryUnsupported ).toBe( true );
				expect( mocks.context.batteryLevel ).toBeNull();
			} );

			it( 'reverts to the unsupported idle state when a synthetic override is cleared', () => {
				// Arm on a platform with no Battery Status API: the synthetic
				// reading unlocks the cockpit.
				setOverride( { charging: false, level: 0.3 } );
				mocks.config!.callbacks.initBattery();
				expect( mocks.context.batterySupported ).toBe( true );
				expect( mocks.context.batteryLevel ).toBe( 30 );

				// Clear both fields: with no raw reading to fall back on, the
				// whole idle state must revert — not just stop updating — so the
				// forced readouts do not linger as if they were real.
				setOverride( { charging: null, level: null } );
				mocks.config!.callbacks.syncBatteryOverride();

				expect( mocks.context.batterySupported ).toBe( false );
				expect( mocks.context.batteryLevel ).toBeNull();
				expect( mocks.context.batteryCharging ).toBe( false );
				expect( mocks.config!.state.isBatteryUnsupported ).toBe( true );
			} );

			it( 'stops a run powered by a synthetic override when the override is cleared', () => {
				setOverride( { charging: false, level: 0.8 } );
				mocks.config!.callbacks.initBattery();
				mocks.context.running = true;

				// Chosen behavior: clearing the override mid-run is a manual dev
				// action, so the run is stopped with the `stopped` reason (its
				// summary is preserved through the normal teardown) and the
				// cockpit then reverts to the locked, unsupported idle state —
				// a live run must never continue with no battery source at all.
				setOverride( { charging: null, level: null } );
				mocks.config!.callbacks.syncBatteryOverride();

				expect( mocks.context.running ).toBe( false );
				expect( mocks.context.ended ).toBe( true );
				expect( mocks.context.endReason ).toBe( 'stopped' );
				expect( mocks.context.batterySupported ).toBe( false );
				expect( mocks.context.batteryLevel ).toBeNull();
			} );

			it( 'does not lock a supported browser whose first reading has not arrived yet', () => {
				// A real battery API exists, but its async acquisition has not
				// delivered a reading yet (lastReading is still null). The watch
				// firing with no override in effect must leave the seeded
				// supported state alone.
				( navigator as { getBattery?: unknown } ).getBattery = () =>
					new Promise( () => undefined );

				setOverride( { charging: null, level: null } );
				mocks.config!.callbacks.syncBatteryOverride();

				expect( mocks.context.batterySupported ).toBe( true );
			} );
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

			// 1% over 10 min → 6 %/h; full-charge runtime 100% at 6 %/h → 60,000 s.
			expect( mocks.context.rateSession ).toBe( 6 );
			expect( mocks.context.rate10 ).toBe( 6 );
			expect( mocks.context.secondsToEmpty ).toBe( 60_000 );

			// Ending the run freezes the summary onto the context: battery start
			// and end, drop, and the serialised drain-graph draw model.
			mocks.config?.actions.toggleRun();
			expect( mocks.context.summaryBatteryStart ).toBe( '80' );
			expect( mocks.context.summaryBatteryEnd ).toBe( '79' );
			expect( mocks.context.summaryDropped ).toBe( '1' );
			expect( mocks.context.hasGraph ).toBe( true );
			const graph = JSON.parse( mocks.context.graphJson );
			expect( graph.line.startsWith( 'M' ) ).toBe( true );
			expect( graph.area.endsWith( 'Z' ) ).toBe( true );

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
			expect( mocks.context.endReason ).toBe( 'plugged' );

			// A later reading while plugged in does not resume the calculations.
			mockBattery.level = 0.5;
			handlers( 'levelchange' )();
			expect( mocks.context.rateSession ).toBeNull();

			cleanup();
		} );

		it( 'stops a target-drop run when the battery reaches the target', async () => {
			const mockBattery = {
				level: 0.8,
				charging: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			mocks.context.mode = 'targetDrop';
			mocks.context.targetPercent = 75;
			mocks.config!.actions.toggleRun();
			const cleanup = mocks.config!.callbacks.initBattery();
			await vi.waitFor( () =>
				expect( mockBattery.addEventListener ).toHaveBeenCalled()
			);

			const onChange = mockBattery.addEventListener.mock.calls.find(
				( call ) => call[ 0 ] === 'levelchange'
			)?.[ 1 ] as () => void;

			// One step above the target: the target holds (not dragged down) and
			// the run keeps going.
			mockBattery.level = 0.76;
			onChange();
			expect( mocks.context.batteryLevel ).toBe( 76 );
			expect( mocks.context.targetPercent ).toBe( 75 );
			expect( mocks.context.running ).toBe( true );

			// Reaches the target exactly: the run stops at 75, not a step later.
			mockBattery.level = 0.75;
			onChange();
			expect( mocks.context.running ).toBe( false );
			expect( mocks.context.endReason ).toBe( 'targetDrop' );

			// The reading that reached the target is recorded BEFORE the stop, so
			// the frozen summary reflects the final drop instead of discarding it
			// (which left a 80 → 80, nothing-dropped, no-rates summary).
			expect( mocks.context.summaryBatteryEnd ).toBe( '75' );
			expect( mocks.context.summaryDropped ).not.toBe( '—' );
			expect( mocks.context.summaryDropped ).not.toBe( '0' );

			cleanup();
		} );

		it( 'does not stop a duration run on the battery level', async () => {
			const mockBattery = {
				level: 0.8,
				charging: false,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
			( navigator as { getBattery?: unknown } ).getBattery = () =>
				Promise.resolve( mockBattery );

			mocks.context.mode = 'duration';
			mocks.context.targetPercent = 75;
			mocks.config!.actions.toggleRun();
			const cleanup = mocks.config!.callbacks.initBattery();
			await vi.waitFor( () =>
				expect( mockBattery.addEventListener ).toHaveBeenCalled()
			);

			const onChange = mockBattery.addEventListener.mock.calls.find(
				( call ) => call[ 0 ] === 'levelchange'
			)?.[ 1 ] as () => void;

			// Well past the target value, but duration mode ignores the level.
			mockBattery.level = 0.7;
			onChange();
			expect( mocks.context.batteryLevel ).toBe( 70 );
			expect( mocks.context.running ).toBe( true );

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
			mocks.config!.callbacks.syncRunActivity();
			expect( heartbeats() ).toHaveLength( 0 );

			// Run live: the watch starts the poll at the 30s cadence.
			mocks.context.running = true;
			mocks.config!.callbacks.syncRunActivity();
			expect( heartbeats() ).toHaveLength( 1 );
			const beatIndex = setSpy.mock.calls.findIndex(
				( call ) => call[ 1 ] === 30_000
			);
			const beatId = setSpy.mock.results[ beatIndex ]!.value;

			// The poll is idempotent while the run continues (no second timer).
			mocks.config!.callbacks.syncRunActivity();
			expect( heartbeats() ).toHaveLength( 1 );

			// Run ends — by any cause that flips `running` — and the poll stops.
			mocks.context.running = false;
			mocks.config!.callbacks.syncRunActivity();
			expect( clearSpy ).toHaveBeenCalledWith( beatId );

			cleanup();
		} );
	} );

	describe( 'screen wake lock', () => {
		afterEach( () => {
			delete ( navigator as { wakeLock?: unknown } ).wakeLock;
		} );

		/** A fake wake-lock sentinel whose `release` event can be fired. */
		const fakeSentinel = () => {
			const listeners: Record< string, () => void > = {};
			const sentinel = {
				released: false,
				release: vi.fn( () => {
					sentinel.released = true;
					return Promise.resolve();
				} ),
				addEventListener: ( type: string, listener: () => void ) => {
					listeners[ type ] = listener;
				},
				removeEventListener: ( type: string ) => {
					delete listeners[ type ];
				},
				fire: ( type: string ) => listeners[ type ]?.(),
			};

			return sentinel;
		};

		it( 'holds the lock while a run is live and drops it on stop', async () => {
			const sentinel = fakeSentinel();
			const request = vi.fn( () => Promise.resolve( sentinel ) );
			( navigator as { wakeLock?: unknown } ).wakeLock = { request };

			const cleanup = mocks.config!.callbacks.initWakeLock();

			// The watch takes the lock when the run goes live.
			mocks.context.running = true;
			mocks.config!.callbacks.syncRunActivity();
			await vi.waitFor( () =>
				expect( request ).toHaveBeenCalledTimes( 1 )
			);

			// And drops it when the run ends.
			mocks.context.running = false;
			mocks.config!.callbacks.syncRunActivity();
			await vi.waitFor( () =>
				expect( sentinel.release ).toHaveBeenCalled()
			);

			cleanup();
		} );

		it( 're-acquires the lock when the page becomes visible during a run', async () => {
			const first = fakeSentinel();
			const second = fakeSentinel();
			const request = vi
				.fn()
				.mockResolvedValueOnce( first )
				.mockResolvedValueOnce( second );
			( navigator as { wakeLock?: unknown } ).wakeLock = { request };

			const cleanup = mocks.config!.callbacks.initWakeLock();
			mocks.context.running = true;
			mocks.config!.callbacks.syncRunActivity();
			await vi.waitFor( () =>
				expect( request ).toHaveBeenCalledTimes( 1 )
			);

			// The browser drops the lock when the tab hides.
			first.released = true;
			first.fire( 'release' );

			// Visible again while still running: the lock is re-acquired.
			document.dispatchEvent( new Event( 'visibilitychange' ) );
			await vi.waitFor( () =>
				expect( request ).toHaveBeenCalledTimes( 2 )
			);

			mocks.context.running = false;
			mocks.config!.callbacks.syncRunActivity();
			cleanup();
		} );

		it( 'does not re-acquire on visibility when no run is live', async () => {
			const sentinel = fakeSentinel();
			const request = vi.fn( () => Promise.resolve( sentinel ) );
			( navigator as { wakeLock?: unknown } ).wakeLock = { request };

			const cleanup = mocks.config!.callbacks.initWakeLock();

			// Idle: a visibility change must not grab a lock.
			mocks.context.running = false;
			document.dispatchEvent( new Event( 'visibilitychange' ) );
			await Promise.resolve();
			expect( request ).not.toHaveBeenCalled();

			cleanup();
		} );

		it( 'runs without a lock where the Wake Lock API is unavailable', () => {
			const cleanup = mocks.config!.callbacks.initWakeLock();

			mocks.context.running = true;
			expect( () =>
				mocks.config!.callbacks.syncRunActivity()
			).not.toThrow();

			mocks.context.running = false;
			mocks.config!.callbacks.syncRunActivity();
			cleanup();
		} );
	} );

	describe( 'run summary', () => {
		it( 'ends the run with a reason when stopped by hand', () => {
			mocks.context.running = true;

			mocks.config?.actions.toggleRun();

			expect( mocks.context.ended ).toBe( true );
			expect( mocks.context.endReason ).toBe( 'stopped' );
			expect( mocks.context.flipped ).toBe( false );
			expect( mocks.config?.state.isEnded ).toBe( true );
			expect( mocks.config?.state.isReasonStopped ).toBe( true );
		} );

		it( 'clears the ended summary when a fresh run starts', () => {
			mocks.context.ended = true;
			mocks.context.endReason = 'stopped';
			mocks.context.flipped = true;

			mocks.config?.actions.toggleRun();

			expect( mocks.context.running ).toBe( true );
			expect( mocks.context.ended ).toBe( false );
			expect( mocks.context.endReason ).toBe( '' );
			expect( mocks.context.flipped ).toBe( false );
		} );

		it( 'dismisses the summary to the startup front, then auto-flips to reveal the deck', () => {
			vi.useFakeTimers();
			mocks.context.ended = true;
			mocks.context.endReason = 'stopped';
			mocks.context.flipped = true;
			mocks.context.idleFlipped = true;

			mocks.config?.actions.newRun();

			// Immediately: back to the startup front — summary gone, both cards
			// reset to their picture front, deck tucked away, no run started.
			expect( mocks.context.ended ).toBe( false );
			expect( mocks.context.endReason ).toBe( '' );
			expect( mocks.context.flipped ).toBe( false );
			expect( mocks.context.idleFlipped ).toBe( false );
			expect( mocks.config?.state.isDeckShown ).toBe( false );
			expect( mocks.context.running ).toBe( false );

			// After the beat: the startup card auto-flips to its how-it-works back,
			// sliding the deck in — without the user re-flipping by hand.
			vi.advanceTimersByTime( 1000 );
			expect( mocks.context.idleFlipped ).toBe( true );
			expect( mocks.config?.state.isDeckShown ).toBe( true );
			expect( mocks.context.running ).toBe( false );

			vi.useRealTimers();
		} );

		it( 'auto-flip sets the flip state explicitly, not toggling a hand flip back', () => {
			vi.useFakeTimers();
			mocks.context.ended = true;

			mocks.config?.actions.newRun();

			// The user flips to the back by hand during the wait.
			mocks.config?.actions.toggleIdleFlip();
			expect( mocks.context.idleFlipped ).toBe( true );

			// The pending auto-flip lands on the back too (idempotent) instead of
			// toggling the user's flip back to the front.
			vi.advanceTimersByTime( 1000 );
			expect( mocks.context.idleFlipped ).toBe( true );

			vi.useRealTimers();
		} );

		it( 'detail init rebuilds the drain graph from seeded samples and auto-flips to the report', () => {
			vi.useFakeTimers();
			mocks.context.ended = true;
			mocks.context.flipped = false;
			mocks.context.secondsToEmpty = 7200;
			mocks.context.detailSamples = [
				{ t: 0, level: 0.9, charging: false },
				{ t: 600_000, level: 0.8, charging: false },
			];

			mocks.config?.callbacks.initDetail();

			// The chart is rebuilt client-side from the seeded samples — the server
			// stores none, since the geometry is TypeScript.
			expect( mocks.context.hasGraph ).toBe( true );
			expect( mocks.context.graphJson.length ).toBeGreaterThan( 0 );

			// The card rests on its picture front through the appear animation, then
			// auto-flips to its report back a beat after it settles.
			expect( mocks.context.flipped ).toBe( false );
			vi.advanceTimersByTime( 1300 );
			expect( mocks.context.flipped ).toBe( true );

			vi.useRealTimers();
		} );

		it( 'detail init leaves no graph when the run has too few samples to plot', () => {
			vi.useFakeTimers();
			mocks.context.detailSamples = [
				{ t: 0, level: 0.9, charging: false },
			];

			mocks.config?.callbacks.initDetail();

			expect( mocks.context.hasGraph ).toBe( false );
			expect( mocks.context.graphJson ).toBe( '' );

			vi.useRealTimers();
		} );

		it( 'turns the summary card between front and back', () => {
			expect( mocks.config?.state.isFlipped ).toBe( false );

			mocks.config?.actions.toggleFlip();
			expect( mocks.context.flipped ).toBe( true );
			expect( mocks.config?.state.isFlipped ).toBe( true );

			mocks.config?.actions.toggleFlip();
			expect( mocks.config?.state.isFlipped ).toBe( false );
		} );

		it( 'turns the startup card and reveals the deck when flipped', () => {
			// At session start: front shown, deck tucked away (not shown).
			expect( mocks.config?.state.isIdleFlipped ).toBe( false );
			expect( mocks.config?.state.isDeckShown ).toBe( false );

			// Flip to the how-it-works back: deck slides in (coupled).
			mocks.config?.actions.toggleIdleFlip();
			expect( mocks.context.idleFlipped ).toBe( true );
			expect( mocks.config?.state.isIdleFlipped ).toBe( true );
			expect( mocks.config?.state.isDeckShown ).toBe( true );

			// Flip back to the front: deck tucks away again.
			mocks.config?.actions.toggleIdleFlip();
			expect( mocks.config?.state.isIdleFlipped ).toBe( false );
			expect( mocks.config?.state.isDeckShown ).toBe( false );
		} );

		it( 'keeps the deck present while a run is live regardless of the flip', () => {
			mocks.context.running = true;
			mocks.context.idleFlipped = false;

			// The deck carries the readouts pill mid-run, so it is always shown.
			expect( mocks.config?.state.isDeckShown ).toBe( true );
		} );

		it( 'keeps the deck hidden when the unsupported warning is flipped open', () => {
			mocks.context.batterySupported = false;
			mocks.context.idleFlipped = true;

			// The card can turn to the warning back, but with no run possible the
			// deck never slides in.
			expect( mocks.config?.state.isDeckShown ).toBe( false );
		} );

		it( 'formats the elapsed run clock for the summary', () => {
			mocks.context.elapsed = 75;
			expect( mocks.config?.state.summaryElapsed ).toBe( '01:15' );
		} );

		it( 'has no frozen summary or graph until a run ends', () => {
			expect( mocks.context.hasGraph ).toBe( false );
			expect( mocks.context.summaryBatteryStart ).toBe( '' );
		} );

		it( 'reads the verdict wording for the end reason', () => {
			mocks.context.reasonText = {
				stopped: {
					head: 'Called it early.',
					sig: 'You stopped the run.',
					arc: '· STOPPED ·',
					unit: 'elapsed',
				},
			};
			mocks.context.endReason = 'stopped';

			expect( mocks.config?.state.summaryHeading ).toBe(
				'Called it early.'
			);
			expect( mocks.config?.state.summarySig ).toBe(
				'You stopped the run.'
			);
		} );

		it( 'paints the summary chart and postmark text imperatively from the run', () => {
			const root = document.createElement( 'div' );
			root.innerHTML =
				'<svg class="bsb-summary__chart"></svg>' +
				'<span class="bsb-frank__arc-text"></span>' +
				'<span class="bsb-frank__val"></span>' +
				'<span class="bsb-frank__unit"></span>';
			mocks.element = root as unknown as MockElement;
			mocks.context.reasonText = {
				stopped: {
					head: 'h',
					sig: 's',
					arc: '· STOPPED ·',
					unit: 'elapsed',
				},
			};
			mocks.context.endReason = 'stopped';
			mocks.context.elapsed = 75;
			mocks.context.graphJson = JSON.stringify( {
				frame: { left: 30, right: 470, top: 10, bottom: 208 },
				area: 'M 30 10 L 470 208 Z',
				line: 'M 30 10 L 470 208',
				fit: 'M 30 10 L 470 208',
				dots: [ { cx: 30, cy: 10 } ],
				yTicks: [ { pos: 10, label: '100' } ],
				xTicks: [ { pos: 30, label: '0m' } ],
			} );

			mocks.config?.callbacks.renderSummary();

			// The chart was repainted from the frozen model …
			const chart = root.querySelector( '.bsb-summary__chart' )!;
			expect( chart.childNodes.length ).toBeGreaterThan( 0 );
			// … and the postmark text set from the run.
			expect(
				root.querySelector( '.bsb-frank__arc-text' )!.textContent
			).toBe( '· STOPPED ·' );
			expect( root.querySelector( '.bsb-frank__val' )!.textContent ).toBe(
				'01:15'
			);
			expect(
				root.querySelector( '.bsb-frank__unit' )!.textContent
			).toBe( 'elapsed' );
		} );
	} );

	describe( 'finish sound', () => {
		/**
		 * Installs a recording stand-in for the platform `AudioContext`, so the
		 * chime the store builds on init sounds through it. Returns whether any
		 * note was sounded.
		 */
		const installAudio = (): { played: () => boolean } => {
			let notes = 0;
			class MockAudioContext {
				currentTime = 0;
				state = 'running';
				destination = { connect: ( node: unknown ) => node };
				resume(): void {}
				createOscillator() {
					notes += 1;
					return {
						type: '',
						frequency: { value: 0 },
						connect: ( node: unknown ) => node,
						start: () => undefined,
						stop: () => undefined,
					};
				}
				createGain() {
					return {
						gain: {
							setValueAtTime: () => undefined,
							linearRampToValueAtTime: () => undefined,
							exponentialRampToValueAtTime: () => undefined,
						},
						connect: ( node: unknown ) => node,
					};
				}
			}
			( window as { AudioContext?: unknown } ).AudioContext =
				MockAudioContext as unknown;

			return { played: () => notes > 0 };
		};

		afterEach( () => {
			delete ( window as { AudioContext?: unknown } ).AudioContext;
			window.localStorage.clear();
		} );

		it( 'reflects whether the finish sound is enabled', () => {
			expect( mocks.config?.state.isSoundOn ).toBe( true );

			mocks.context.soundEnabled = false;
			expect( mocks.config?.state.isSoundOn ).toBe( false );
		} );

		it( 'toggles the finish sound and remembers the choice', () => {
			installAudio();
			mocks.config!.callbacks.initSound();

			mocks.config!.actions.toggleSound();
			expect( mocks.context.soundEnabled ).toBe( false );
			expect( window.localStorage.getItem( 'bsb-cockpit-sound' ) ).toBe(
				'off'
			);

			mocks.config!.actions.toggleSound();
			expect( mocks.context.soundEnabled ).toBe( true );
			expect( window.localStorage.getItem( 'bsb-cockpit-sound' ) ).toBe(
				'on'
			);
		} );

		it( 'restores the remembered preference on init', () => {
			installAudio();

			window.localStorage.setItem( 'bsb-cockpit-sound', 'off' );
			mocks.config!.callbacks.initSound();
			expect( mocks.context.soundEnabled ).toBe( false );

			window.localStorage.setItem( 'bsb-cockpit-sound', 'on' );
			mocks.config!.callbacks.initSound();
			expect( mocks.context.soundEnabled ).toBe( true );
		} );

		it( 'sounds the chime when a run finishes naturally', () => {
			const audio = installAudio();
			mocks.config!.callbacks.initSound();

			vi.useFakeTimers();
			mocks.context.mode = 'duration';
			mocks.context.durationMinutes = 5;
			mocks.context.running = true;
			mocks.context.elapsed = 299;

			mocks.config!.callbacks.syncRunActivity();
			vi.advanceTimersByTime( 1000 );

			expect( mocks.context.endReason ).toBe( 'duration' );
			expect( audio.played() ).toBe( true );

			vi.useRealTimers();
		} );

		it( 'stays silent on a manual stop', () => {
			const audio = installAudio();
			mocks.config!.callbacks.initSound();

			mocks.config!.actions.toggleRun();
			mocks.config!.actions.toggleRun();

			expect( mocks.context.endReason ).toBe( 'stopped' );
			expect( audio.played() ).toBe( false );
		} );

		it( 'stays silent at a natural finish when disabled', () => {
			const audio = installAudio();
			window.localStorage.setItem( 'bsb-cockpit-sound', 'off' );
			mocks.config!.callbacks.initSound();

			vi.useFakeTimers();
			mocks.context.mode = 'duration';
			mocks.context.durationMinutes = 5;
			mocks.context.running = true;
			mocks.context.elapsed = 299;

			mocks.config!.callbacks.syncRunActivity();
			vi.advanceTimersByTime( 1000 );

			expect( mocks.context.endReason ).toBe( 'duration' );
			expect( audio.played() ).toBe( false );

			vi.useRealTimers();
		} );
	} );

	describe( 'toast', () => {
		it( 'raises the view-only notice on viewport entry, once per run', () => {
			mocks.context.running = true;

			mocks.config!.actions.viewportEnter();
			expect( mocks.context.toastKind ).toBe( 'notice' );
			expect( mocks.config!.state.isToastNotice ).toBe( true );
			expect( mocks.config!.state.toastMessage ).toBe( 'View only' );
			expect( mocks.context.toastPhase ).toBe( 'entering' );

			// Run the notice through its lifecycle to a clean close.
			mocks.config!.callbacks.onToastAnimationEnd();
			expect( mocks.context.toastPhase ).toBe( 'holding' );
			mocks.config!.actions.dismissToast();
			expect( mocks.context.toastPhase ).toBe( 'leaving' );
			mocks.config!.callbacks.onToastAnimationEnd();
			expect( mocks.context.toastKind ).toBe( '' );

			// Already shown this run: a second entry does not raise it again.
			mocks.config!.actions.viewportEnter();
			expect( mocks.context.toastKind ).toBe( '' );
		} );

		it( 'ignores viewport entry when no run is live', () => {
			mocks.context.running = false;
			mocks.config!.actions.viewportEnter();
			expect( mocks.context.toastKind ).toBe( '' );
		} );

		it( 'reports the assertive role for an error toast', () => {
			mocks.context.toastKind = 'error';
			expect( mocks.config!.state.hasToast ).toBe( true );
			expect( mocks.config!.state.isToastError ).toBe( true );
			expect( mocks.config!.state.toastRole ).toBe( 'alert' );
		} );
	} );
} );
