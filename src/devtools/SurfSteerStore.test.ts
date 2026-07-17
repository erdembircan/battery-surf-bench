/**
 * Tests for the Surf sub-tool slice: the Natural/Sterile seg, the iframe
 * message handshake (`bsb:behaviorStart`/`bsb:behaviorEnd`/`bsb:pageAffordances`),
 * the countdown ticker, the per-chip gating/running/duration getters, the
 * steer action's iframe post, and the page-stepper command emission.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

/** A stand-in for the element that triggered an action or is read by a getter. */
interface MockElement {
	dataset: Record< string, string >;
}

interface MockSurf {
	sterile: boolean;
	behaviorKey: string;
	remainingMs: number | null;
	affordances: {
		hasVideo: boolean;
		imageCount: number;
		textDensity: number;
	} | null;
	pageStep: { delta: -1 | 1; seq: number } | null;
}

interface MockDevtoolsState {
	open: boolean;
	battery: { charging: boolean | null; level: number | null };
	sim: { running: boolean };
	surf: MockSurf;
}

const mocks = vi.hoisted( () => ( {
	state: undefined as unknown as { devtools: MockDevtoolsState },
	element: { dataset: {} } as MockElement,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: () => ( { state: mocks.state } ),
	getElement: () => ( { ref: mocks.element } ),
} ) );

import { surfSteerStore } from './SurfSteerStore';

const actions = surfSteerStore.actions as unknown as {
	devtoolsSurfSetMode: () => void;
	devtoolsSurfSteer: () => void;
	devtoolsSurfStep: () => void;
};
const derived = surfSteerStore.state as unknown as {
	devtoolsIsSurfNatural: boolean;
	devtoolsIsSurfSterile: boolean;
	devtoolsSurfIsRunning: boolean;
	devtoolsSurfCountdownDisplay: string;
	devtoolsSurfAffordanceGlyphs: string;
	devtoolsSurfChipDisabled: boolean;
	devtoolsSurfChipRunning: boolean;
	devtoolsSurfChipDurationCss: string;
	devtoolsSurfStepDisabled: boolean;
};
const callbacks = surfSteerStore.callbacks as unknown as {
	devtoolsInitSurf: () => () => void;
};

const ORIGIN = window.location.origin;

const defaultSurf = (): MockSurf => ( {
	sterile: false,
	behaviorKey: '',
	remainingMs: null,
	affordances: null,
	pageStep: null,
} );

const chip = ( key: string ): void => {
	mocks.element = { dataset: { devtoolsBehavior: key } };
};

const postMessageToWindow = ( data: unknown, origin = ORIGIN ): void => {
	window.dispatchEvent( new MessageEvent( 'message', { data, origin } ) );
};

beforeEach( () => {
	vi.useFakeTimers();
	mocks.state = {
		devtools: {
			open: false,
			battery: { charging: null, level: null },
			sim: { running: false },
			surf: defaultSurf(),
		},
	};
	mocks.element = { dataset: {} };
} );

afterEach( () => {
	vi.useRealTimers();
} );

describe( 'Natural/Sterile seg', () => {
	it( 'reads which seg option is selected', () => {
		expect( derived.devtoolsIsSurfNatural ).toBe( true );
		expect( derived.devtoolsIsSurfSterile ).toBe( false );

		mocks.state.devtools.surf.sterile = true;

		expect( derived.devtoolsIsSurfNatural ).toBe( false );
		expect( derived.devtoolsIsSurfSterile ).toBe( true );
	} );

	it( 'arms and disarms the sterile override from the seg option’s dataset', () => {
		mocks.element = { dataset: { devtoolsSurfMode: 'sterile' } };
		actions.devtoolsSurfSetMode();
		expect( mocks.state.devtools.surf.sterile ).toBe( true );

		mocks.element = { dataset: { devtoolsSurfMode: 'natural' } };
		actions.devtoolsSurfSetMode();
		expect( mocks.state.devtools.surf.sterile ).toBe( false );
	} );

	it( 'ignores an unrecognized mode choice', () => {
		mocks.state.devtools.surf.sterile = true;
		mocks.element = { dataset: { devtoolsSurfMode: 'bogus' } };

		actions.devtoolsSurfSetMode();

		expect( mocks.state.devtools.surf.sterile ).toBe( true );
	} );
} );

describe( 'message handling', () => {
	it( 'bsb:behaviorStart sets the running key and starts the countdown when a duration was announced', () => {
		const cleanup = callbacks.devtoolsInitSurf();

		postMessageToWindow( {
			type: 'bsb:behaviorStart',
			key: 'readPause',
			durationMs: 8000,
		} );

		expect( mocks.state.devtools.surf.behaviorKey ).toBe( 'readPause' );
		expect( mocks.state.devtools.surf.remainingMs ).toBe( 8000 );

		vi.advanceTimersByTime( 1000 );
		expect( mocks.state.devtools.surf.remainingMs ).toBe( 7000 );

		vi.advanceTimersByTime( 3000 );
		expect( mocks.state.devtools.surf.remainingMs ).toBe( 4000 );

		cleanup();
	} );

	it( 'the countdown never goes below zero', () => {
		const cleanup = callbacks.devtoolsInitSurf();

		postMessageToWindow( {
			type: 'bsb:behaviorStart',
			key: 'lingerImage',
			durationMs: 1500,
		} );

		vi.advanceTimersByTime( 5000 );

		expect( mocks.state.devtools.surf.remainingMs ).toBe( 0 );

		cleanup();
	} );

	it( 'bsb:behaviorEnd clears the running key, the countdown, and stops the ticker', () => {
		const cleanup = callbacks.devtoolsInitSurf();

		postMessageToWindow( {
			type: 'bsb:behaviorStart',
			key: 'readPause',
			durationMs: 8000,
		} );
		postMessageToWindow( { type: 'bsb:behaviorEnd', key: 'readPause' } );

		expect( mocks.state.devtools.surf.behaviorKey ).toBe( '' );
		expect( mocks.state.devtools.surf.remainingMs ).toBeNull();

		// The ticker really stopped: advancing the clock writes nothing further.
		vi.advanceTimersByTime( 5000 );
		expect( mocks.state.devtools.surf.remainingMs ).toBeNull();

		cleanup();
	} );

	it( 'bsb:behaviorEnd for a mechanical (never-announced) behavior is a harmless no-op clear', () => {
		const cleanup = callbacks.devtoolsInitSurf();

		postMessageToWindow( { type: 'bsb:behaviorEnd', key: 'scrollBurst' } );

		expect( mocks.state.devtools.surf.behaviorKey ).toBe( '' );
		expect( mocks.state.devtools.surf.remainingMs ).toBeNull();

		cleanup();
	} );

	it( 'bsb:pageAffordances stores the affordance flags', () => {
		const cleanup = callbacks.devtoolsInitSurf();

		postMessageToWindow( {
			type: 'bsb:pageAffordances',
			affordances: { hasVideo: true, imageCount: 3, textDensity: 0.8 },
		} );

		expect( mocks.state.devtools.surf.affordances ).toEqual( {
			hasVideo: true,
			imageCount: 3,
			textDensity: 0.8,
		} );

		cleanup();
	} );

	it( 'ignores a message from a foreign origin', () => {
		const cleanup = callbacks.devtoolsInitSurf();

		postMessageToWindow(
			{ type: 'bsb:behaviorStart', key: 'readPause', durationMs: 8000 },
			'https://evil.test'
		);

		expect( mocks.state.devtools.surf.behaviorKey ).toBe( '' );

		cleanup();
	} );

	it( 'the returned cleanup detaches the listener', () => {
		const cleanup = callbacks.devtoolsInitSurf();
		cleanup();

		postMessageToWindow( {
			type: 'bsb:behaviorStart',
			key: 'readPause',
			durationMs: 8000,
		} );

		expect( mocks.state.devtools.surf.behaviorKey ).toBe( '' );
	} );
} );

describe( 'devtoolsSurfCountdownDisplay', () => {
	it( 'is empty while idle', () => {
		expect( derived.devtoolsSurfCountdownDisplay ).toBe( '' );
	} );

	it( 'reads "key · MM:SS" while a duration counts down', () => {
		mocks.state.devtools.surf.behaviorKey = 'readPause';
		mocks.state.devtools.surf.remainingMs = 65000;

		expect( derived.devtoolsSurfCountdownDisplay ).toBe(
			'readPause · 01:05'
		);
	} );

	it( 'reads the bare key for a mechanical behavior that announced no duration', () => {
		mocks.state.devtools.surf.behaviorKey = 'scrollBurst';
		mocks.state.devtools.surf.remainingMs = null;

		expect( derived.devtoolsSurfCountdownDisplay ).toBe( 'scrollBurst' );
	} );

	it( 'devtoolsSurfIsRunning tracks whether a behavior is currently steered', () => {
		expect( derived.devtoolsSurfIsRunning ).toBe( false );
		mocks.state.devtools.surf.behaviorKey = 'readPause';
		expect( derived.devtoolsSurfIsRunning ).toBe( true );
	} );
} );

describe( 'devtoolsSurfAffordanceGlyphs', () => {
	it( 'reads an em dash when there is no live sterile page', () => {
		expect( derived.devtoolsSurfAffordanceGlyphs ).toBe( '—' );
	} );

	it( 'concatenates the glyphs for each true flag, in text/image/video order', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: true,
			imageCount: 2,
			textDensity: 0.6,
		};

		expect( derived.devtoolsSurfAffordanceGlyphs ).toBe( '▤▦▶' );
	} );

	it( 'omits a glyph for a false flag', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: false,
			imageCount: 0,
			textDensity: 0.6,
		};

		expect( derived.devtoolsSurfAffordanceGlyphs ).toBe( '▤' );
	} );
} );

describe( 'devtoolsSurfChipDisabled', () => {
	it( 'is disabled for every key when there is no live sterile page', () => {
		chip( 'scrollBurst' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( true );
	} );

	it( 'is disabled for every chip while a behavior is running, even a chip with no gate of its own', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: true,
			imageCount: 4,
			textDensity: 1,
		};
		mocks.state.devtools.surf.behaviorKey = 'readPause';

		chip( 'scrollBurst' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( true );
	} );

	it( 'gates watchVideo on hasVideo', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: false,
			imageCount: 4,
			textDensity: 1,
		};
		chip( 'watchVideo' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( true );

		mocks.state.devtools.surf.affordances.hasVideo = true;
		expect( derived.devtoolsSurfChipDisabled ).toBe( false );
	} );

	it( 'gates lingerImage on imageCount > 0', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: true,
			imageCount: 0,
			textDensity: 1,
		};
		chip( 'lingerImage' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( true );

		mocks.state.devtools.surf.affordances.imageCount = 1;
		expect( derived.devtoolsSurfChipDisabled ).toBe( false );
	} );

	it( 'gates readPause and selectSnippet on textDensity > 0', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: true,
			imageCount: 4,
			textDensity: 0,
		};
		chip( 'readPause' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( true );
		chip( 'selectSnippet' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( true );

		mocks.state.devtools.surf.affordances.textDensity = 0.1;
		chip( 'readPause' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( false );
		chip( 'selectSnippet' );
		expect( derived.devtoolsSurfChipDisabled ).toBe( false );
	} );

	it( 'has no gate for the other mechanical/ungated keys once a live sterile page exists', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: false,
			imageCount: 0,
			textDensity: 0,
		};

		for ( const key of [
			'scrollBurst',
			'glanceBack',
			'fidgetWiggle',
			'microScroll',
			'moveOn',
		] ) {
			chip( key );
			expect( derived.devtoolsSurfChipDisabled ).toBe( false );
		}
	} );
} );

describe( 'the running chip’s own getters', () => {
	beforeEach( () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: true,
			imageCount: 4,
			textDensity: 1,
		};
	} );

	it( 'devtoolsSurfChipRunning is true only for the chip matching the running key', () => {
		mocks.state.devtools.surf.behaviorKey = 'readPause';

		chip( 'readPause' );
		expect( derived.devtoolsSurfChipRunning ).toBe( true );

		chip( 'lingerImage' );
		expect( derived.devtoolsSurfChipRunning ).toBe( false );
	} );

	it( 'devtoolsSurfChipRunning is false for every chip while idle', () => {
		chip( 'readPause' );
		expect( derived.devtoolsSurfChipRunning ).toBe( false );
	} );

	it( 'devtoolsSurfChipDurationCss feeds the running chip the FULL announced duration, fixed for the whole run', () => {
		const cleanup = callbacks.devtoolsInitSurf();

		postMessageToWindow( {
			type: 'bsb:behaviorStart',
			key: 'lingerImage',
			durationMs: 3200,
		} );

		chip( 'lingerImage' );
		expect( derived.devtoolsSurfChipDurationCss ).toBe( '3200ms' );

		// The countdown ticks down, but the CSS duration must stay fixed —
		// re-feeding it the ticking value would restart the fill animation
		// every second.
		vi.advanceTimersByTime( 1000 );
		expect( derived.devtoolsSurfChipDurationCss ).toBe( '3200ms' );

		cleanup();
	} );

	it( 'devtoolsSurfChipDurationCss is 0ms for a chip that is not the one running', () => {
		mocks.state.devtools.surf.behaviorKey = 'readPause';
		chip( 'lingerImage' );

		expect( derived.devtoolsSurfChipDurationCss ).toBe( '0ms' );
	} );
} );

describe( 'devtoolsSurfSteer', () => {
	let iframe: HTMLIFrameElement;
	let postSpy: ReturnType< typeof vi.fn >;

	beforeEach( () => {
		iframe = document.createElement( 'iframe' );
		iframe.className = 'bsb-cockpit__viewport';
		document.body.appendChild( iframe );
		postSpy = vi.fn();
		Object.defineProperty( iframe, 'contentWindow', {
			value: { postMessage: postSpy },
			configurable: true,
		} );
	} );

	afterEach( () => {
		iframe.remove();
	} );

	it( 'posts bsb:steerBehavior to the viewport iframe’s contentWindow with the page origin', () => {
		chip( 'readPause' );

		actions.devtoolsSurfSteer();

		expect( postSpy ).toHaveBeenCalledWith(
			{ type: 'bsb:steerBehavior', key: 'readPause' },
			window.location.origin
		);
	} );

	it( 'is a no-op when the chip carries no behavior key', () => {
		mocks.element = { dataset: {} };

		actions.devtoolsSurfSteer();

		expect( postSpy ).not.toHaveBeenCalled();
	} );

	it( 'is a no-op when the viewport iframe is absent', () => {
		iframe.remove();
		chip( 'readPause' );

		expect( () => actions.devtoolsSurfSteer() ).not.toThrow();
		expect( postSpy ).not.toHaveBeenCalled();
	} );
} );

describe( 'the page stepper', () => {
	it( 'writes a pageStep command with a fresh monotonic seq on every click', () => {
		mocks.element = { dataset: { step: '-1' } };
		actions.devtoolsSurfStep();
		const first = mocks.state.devtools.surf.pageStep;
		expect( first?.delta ).toBe( -1 );

		mocks.element = { dataset: { step: '1' } };
		actions.devtoolsSurfStep();
		const second = mocks.state.devtools.surf.pageStep;
		expect( second?.delta ).toBe( 1 );

		expect( second?.seq ).toBeGreaterThan( first?.seq ?? -1 );
	} );

	it( 'a repeat of the same direction still bumps the seq, so the watch re-fires', () => {
		mocks.element = { dataset: { step: '1' } };
		actions.devtoolsSurfStep();
		const first = mocks.state.devtools.surf.pageStep;

		actions.devtoolsSurfStep();
		const second = mocks.state.devtools.surf.pageStep;

		expect( second?.delta ).toBe( 1 );
		expect( second?.seq ).toBeGreaterThan( first?.seq ?? -1 );
	} );

	it( 'ignores a malformed step value', () => {
		mocks.element = { dataset: { step: 'bogus' } };

		actions.devtoolsSurfStep();

		expect( mocks.state.devtools.surf.pageStep ).toBeNull();
	} );

	it( 'devtoolsSurfStepDisabled is true while there is no live sterile page', () => {
		expect( mocks.state.devtools.surf.affordances ).toBeNull();
		expect( derived.devtoolsSurfStepDisabled ).toBe( true );

		mocks.state.devtools.surf.affordances = {
			hasVideo: false,
			imageCount: 0,
			textDensity: 0,
		};
		expect( derived.devtoolsSurfStepDisabled ).toBe( false );
	} );

	it( 'devtoolsSurfStepDisabled is true while a behavior is running, even with a live sterile page', () => {
		mocks.state.devtools.surf.affordances = {
			hasVideo: false,
			imageCount: 0,
			textDensity: 0,
		};
		expect( derived.devtoolsSurfStepDisabled ).toBe( false );

		mocks.state.devtools.surf.behaviorKey = 'readPause';
		expect( derived.devtoolsSurfStepDisabled ).toBe( true );
	} );
} );
