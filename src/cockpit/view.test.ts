/**
 * Tests for the cockpit Interactivity store.
 *
 * The store's consumer is the block markup: the viewport iframe binds its `src`
 * to `state.currentSrc`, a label binds to `state.currentLabel`, the cycle button
 * calls `actions.next`, and the control deck binds its mode, duration, baseline,
 * speed and stop controls to the rest of the store. These tests stub the
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
	elapsed: number;
	theme: 'light' | 'dark';
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
		currentLabel: string;
		isModeDuration: boolean;
		isModeTargetDrop: boolean;
		durationDisplay: string;
		targetDisplay: string;
		targetColor: string;
		isSpeed1: boolean;
		isSpeed4: boolean;
		isSpeed10: boolean;
		elapsedClock: string;
		batteryDisplay: string;
		batteryColor: string;
		isCharging: boolean;
		isIdle: boolean;
		rate10Display: string;
		rateSessionDisplay: string;
		timeToEmptyDisplay: string;
	};
	actions: {
		next: () => void;
		selectMode: () => void;
		stepDuration: () => void;
		targetPointerDown: ( event: PointerEvent ) => void;
		targetPointerMove: ( event: PointerEvent ) => void;
		targetPointerUp: () => void;
		targetKeyDown: ( event: KeyboardEvent ) => void;
		toggleBaseline: () => void;
		selectSpeed: () => void;
		stop: () => void;
		toggleTheme: () => void;
	};
	callbacks: {
		tick: () => () => void;
		initTheme: () => void;
		initBattery: () => () => void;
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
	elapsed: 0,
	theme: 'light',
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
		it( 'derives the viewport src from the active course page', () => {
			mocks.context.pages = [ page( 'article-1' ) ];

			expect( mocks.config?.state.currentSrc ).toBe(
				'https://example.test/article-1'
			);
		} );

		it( 'yields an empty src when there are no pages to surf', () => {
			expect( mocks.config?.state.currentSrc ).toBe( '' );
		} );

		it( 'labels the active page with its position and title', () => {
			mocks.context.pages = [ page( 'article-1' ), page( 'gallery' ) ];
			mocks.context.activeIndex = 1;

			expect( mocks.config?.state.currentLabel ).toBe( '2/2 — GALLERY' );
		} );

		it( 'cycles to the next page and wraps around', () => {
			mocks.context.pages = [ page( 'article-1' ), page( 'gallery' ) ];

			mocks.config?.actions.next();
			expect( mocks.context.activeIndex ).toBe( 1 );
			expect( mocks.config?.state.currentSrc ).toBe(
				'https://example.test/gallery'
			);

			mocks.config?.actions.next();
			expect( mocks.context.activeIndex ).toBe( 0 );
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

	describe( 'stop', () => {
		it( 'returns the cockpit to its idle state', () => {
			mocks.context.running = true;

			mocks.config?.actions.stop();

			expect( mocks.context.running ).toBe( false );
		} );
	} );

	describe( 'surfing indicator', () => {
		it( 'formats elapsed seconds as a MM:SS clock', () => {
			mocks.context.elapsed = 0;
			expect( mocks.config?.state.elapsedClock ).toBe( '00:00' );

			mocks.context.elapsed = 75;
			expect( mocks.config?.state.elapsedClock ).toBe( '01:15' );

			mocks.context.elapsed = 605;
			expect( mocks.config?.state.elapsedClock ).toBe( '10:05' );
		} );

		it( 'ticks the clock once a second until cleaned up', () => {
			vi.useFakeTimers();

			const cleanup = mocks.config!.callbacks.tick();
			vi.advanceTimersByTime( 3000 );
			expect( mocks.context.elapsed ).toBe( 3 );

			cleanup();
			vi.advanceTimersByTime( 5000 );
			expect( mocks.context.elapsed ).toBe( 3 );

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

		it( 'no-ops where the Battery Status API is unavailable', () => {
			const cleanup = mocks.config?.callbacks.initBattery();
			cleanup?.();

			expect( mocks.context.batteryLevel ).toBeNull();
		} );
	} );

	describe( 'theme', () => {
		beforeEach( () => {
			window.localStorage.clear();
		} );

		it( 'toggles between light and dark and remembers the choice', () => {
			mocks.context.theme = 'light';

			mocks.config?.actions.toggleTheme();
			expect( mocks.context.theme ).toBe( 'dark' );
			expect( window.localStorage.getItem( 'bsb-cockpit-theme' ) ).toBe(
				'dark'
			);

			mocks.config?.actions.toggleTheme();
			expect( mocks.context.theme ).toBe( 'light' );
			expect( window.localStorage.getItem( 'bsb-cockpit-theme' ) ).toBe(
				'light'
			);
		} );

		it( 'restores a remembered theme on init', () => {
			window.localStorage.setItem( 'bsb-cockpit-theme', 'dark' );
			mocks.context.theme = 'light';

			mocks.config?.callbacks.initTheme();

			expect( mocks.context.theme ).toBe( 'dark' );
		} );

		it( 'keeps the seeded theme when nothing is remembered', () => {
			mocks.context.theme = 'light';

			mocks.config?.callbacks.initTheme();

			expect( mocks.context.theme ).toBe( 'light' );
		} );
	} );
} );
