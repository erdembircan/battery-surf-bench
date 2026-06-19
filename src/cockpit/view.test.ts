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

import { vi, describe, it, expect, beforeEach } from 'vitest';

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
}

interface CockpitConfig {
	state: {
		currentSrc: string;
		currentLabel: string;
		isModeDuration: boolean;
		isModeTargetDrop: boolean;
		durationDisplay: string;
		isSpeed1: boolean;
		isSpeed4: boolean;
		isSpeed10: boolean;
	};
	actions: {
		next: () => void;
		selectMode: () => void;
		stepDuration: () => void;
		toggleBaseline: () => void;
		selectSpeed: () => void;
		stop: () => void;
	};
}

/** A stand-in for the element that triggered an action. */
interface MockElement {
	dataset: Record< string, string >;
	checked: boolean;
}

const baseContext = (): CockpitContext => ( {
	pages: [],
	activeIndex: 0,
	mode: 'duration',
	durationMinutes: 30,
	baseline: false,
	speed: 1,
	running: false,
} );

const mocks = vi.hoisted( () => ( {
	config: undefined as CockpitConfig | undefined,
	context: undefined as unknown as CockpitContext,
	element: { dataset: {}, checked: false } as MockElement,
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
	mocks.element = { dataset, checked };
};

beforeEach( () => {
	mocks.context = baseContext();
	mocks.element = { dataset: {}, checked: false };
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
} );
