/**
 * Tests for the shark-fin store slice — the Konami-code Easter egg that
 * releases a dorsal fin into the compact topbar's wave strip. The slice's
 * consumer is the fin markup: it binds visibility and the swim's CSS custom
 * properties to the getters, and a single document-level keydown listener
 * (wired through `initShark`) drives the sequence recognition. These stub the
 * Interactivity runtime and the per-instance clock/state so the sequence
 * timing is fully controllable.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

interface FakeContext {
	running: boolean;
	compact: boolean;
	speed: number;
	sharkSwimming: boolean;
	sharkStartPct: number;
	sharkEndPct: number;
	sharkTotalMs: number;
}

interface FakeInstance {
	sharkTimer: number | null;
	sharkLaunchSeq: number | null;
	konamiProgress: number;
	konamiLastKeyAt: number | null;
}

interface FakeSharkSlice {
	launch: { seq: number } | null;
	launchable: boolean;
}

interface FakeSharedState {
	devtools?: {
		shark?: FakeSharkSlice;
	};
}

const mocks = vi.hoisted( () => ( {
	context: undefined as unknown as FakeContext,
	instance: undefined as unknown as FakeInstance,
	sharedState: undefined as unknown as FakeSharedState,
	now: 0,
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	getContext: () => mocks.context,
	store: () => ( { state: mocks.sharedState } ),
} ) );

vi.mock( '@/cockpit/RunInstance', () => ( {
	instanceFor: () => mocks.instance,
	now: () => mocks.now,
} ) );

import { sharkStore } from '@/cockpit/store/SharkStore';
import { KONAMI_TIMEOUT_MS } from '@/cockpit/KonamiCode';

const state = sharkStore.state as Record< string, unknown >;
const callbacks = sharkStore.callbacks as {
	initShark: () => () => void;
	syncSharkCompact: () => void;
	syncDevtoolsShark: () => void;
};

/**
 * Dispatches a `keydown` for the given key on `document`, first advancing the
 * controlled clock by `gapMs` (the elapsed time since the previous key).
 *
 * @param key    The key to dispatch.
 * @param gapMs  Milliseconds to advance the controlled clock by first.
 * @param repeat Whether to mark the event as a held-key repeat.
 */
const press = ( key: string, gapMs = 50, repeat = false ): void => {
	mocks.now += gapMs;
	document.dispatchEvent( new KeyboardEvent( 'keydown', { key, repeat } ) );
};

/** The full Konami sequence, in the casing a real keyboard event carries. */
const FULL_SEQUENCE = [
	'ArrowUp',
	'ArrowUp',
	'ArrowDown',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowLeft',
	'ArrowRight',
	'b',
	'a',
];

beforeEach( () => {
	mocks.context = {
		running: true,
		compact: true,
		speed: 1,
		sharkSwimming: false,
		sharkStartPct: 0,
		sharkEndPct: 0,
		sharkTotalMs: 0,
	};
	mocks.instance = {
		sharkTimer: null,
		sharkLaunchSeq: null,
		konamiProgress: 0,
		konamiLastKeyAt: null,
	};
	mocks.sharedState = {
		devtools: {
			shark: { launch: null, launchable: false },
		},
	};
	mocks.now = 0;
} );

describe( 'shark store slice', () => {
	describe( 'getters', () => {
		it( 'projects the swim onto CSS values', () => {
			expect( state.hasShark ).toBe( false );

			mocks.context.sharkSwimming = true;
			mocks.context.sharkStartPct = 12.5;
			mocks.context.sharkEndPct = 88;
			mocks.context.sharkTotalMs = 6400;

			expect( state.hasShark ).toBe( true );
			expect( state.sharkStartCss ).toBe( '12.5%' );
			expect( state.sharkEndCss ).toBe( '88%' );
			expect( state.sharkTotalCss ).toBe( '6400ms' );
		} );

		it( 'scales the bob’s swing period by the inverse square root of run speed', () => {
			mocks.context.speed = 1;
			expect( state.sharkBobCss ).toBe( '1700ms' );

			mocks.context.speed = 4;
			expect( state.sharkBobCss ).toBe( '850ms' );

			mocks.context.speed = 10;
			expect( state.sharkBobCss ).toBe( '538ms' );
		} );
	} );

	describe( 'initShark', () => {
		let cleanup: ( () => void ) | undefined;

		afterEach( () => {
			cleanup?.();
			cleanup = undefined;
			vi.useRealTimers();
		} );

		it( 'launches a shark once the full sequence lands with comfortable gaps, while running and compact', () => {
			vi.useFakeTimers();
			cleanup = callbacks.initShark();

			FULL_SEQUENCE.forEach( ( key ) => press( key ) );

			expect( mocks.context.sharkSwimming ).toBe( true );
		} );

		it( 'ignores the sequence while not compact', () => {
			mocks.context.compact = false;
			cleanup = callbacks.initShark();

			FULL_SEQUENCE.forEach( ( key ) => press( key ) );

			expect( mocks.context.sharkSwimming ).toBe( false );
		} );

		it( 'ignores the sequence while not running', () => {
			mocks.context.running = false;
			cleanup = callbacks.initShark();

			FULL_SEQUENCE.forEach( ( key ) => press( key ) );

			expect( mocks.context.sharkSwimming ).toBe( false );
		} );

		it( 'ignores a repeated (held-down) key entirely — it neither advances nor resets', () => {
			vi.useFakeTimers();
			cleanup = callbacks.initShark();

			press( 'ArrowUp' );
			press( 'ArrowUp', 50, true ); // held repeat, ignored — counts for nothing
			press( 'ArrowUp' ); // the sequence's real second key
			press( 'ArrowDown' );
			press( 'ArrowDown' );
			press( 'ArrowLeft' );
			press( 'ArrowRight' );
			press( 'ArrowLeft' );
			press( 'ArrowRight' );
			press( 'b' );
			press( 'a' );

			expect( mocks.context.sharkSwimming ).toBe( true );
		} );

		it( 'resets progress the instant the topbar is not armed, so it cannot carry across an arming boundary', () => {
			cleanup = callbacks.initShark();

			press( 'ArrowUp' );
			press( 'ArrowUp' );
			expect( mocks.instance.konamiProgress ).toBe( 2 );

			// The deck expands mid-sequence.
			mocks.context.compact = false;
			press( 'ArrowDown' );
			expect( mocks.instance.konamiProgress ).toBe( 0 );
			expect( mocks.instance.konamiLastKeyAt ).toBeNull();

			// Re-arming and completing the sequence from here still works —
			// nothing was left over from the interrupted attempt.
			vi.useFakeTimers();
			mocks.context.compact = true;
			FULL_SEQUENCE.forEach( ( key ) => press( key ) );

			expect( mocks.context.sharkSwimming ).toBe( true );
		} );

		it( 'a gap over the timeout mid-sequence resets it — completion then requires re-entering from the top', () => {
			vi.useFakeTimers();
			cleanup = callbacks.initShark();

			press( 'ArrowUp' );
			press( 'ArrowUp' );
			press( 'ArrowDown' );
			press( 'ArrowDown' );
			expect( mocks.instance.konamiProgress ).toBe( 4 );

			// A stale gap before a non-first-element key resets to 0, not 1.
			press( 'ArrowLeft', KONAMI_TIMEOUT_MS + 1 );
			expect( mocks.instance.konamiProgress ).toBe( 0 );
			expect( mocks.context.sharkSwimming ).toBe( false );

			// Completing the rest of the ORIGINAL sequence from here must not
			// succeed — only a full fresh entry does.
			press( 'ArrowRight' );
			press( 'ArrowLeft' );
			press( 'ArrowRight' );
			press( 'b' );
			press( 'a' );
			expect( mocks.context.sharkSwimming ).toBe( false );

			FULL_SEQUENCE.forEach( ( key ) => press( key ) );
			expect( mocks.context.sharkSwimming ).toBe( true );
		} );

		it( 'a gap exactly at the timeout still counts as comfortable (strict greater-than)', () => {
			vi.useFakeTimers();
			cleanup = callbacks.initShark();

			press( 'ArrowUp', 0 );
			FULL_SEQUENCE.slice( 1 ).forEach( ( key ) =>
				press( key, KONAMI_TIMEOUT_MS )
			);

			expect( mocks.context.sharkSwimming ).toBe( true );
		} );

		it( 'is a no-op while a shark is already swimming — one at a time', () => {
			vi.useFakeTimers();
			mocks.context.sharkSwimming = true;
			mocks.context.sharkStartPct = 9;
			cleanup = callbacks.initShark();

			FULL_SEQUENCE.forEach( ( key ) => press( key ) );

			expect( mocks.context.sharkStartPct ).toBe( 9 );
		} );

		it( 'detaches the listener once the returned cleanup runs', () => {
			const detach = callbacks.initShark();
			detach();

			FULL_SEQUENCE.forEach( ( key ) => press( key ) );

			expect( mocks.context.sharkSwimming ).toBe( false );
		} );

		it( 'never calls preventDefault, so normal keyboard use is untouched', () => {
			cleanup = callbacks.initShark();

			const event = new KeyboardEvent( 'keydown', { key: 'ArrowUp' } );
			const spy = vi.spyOn( event, 'preventDefault' );
			document.dispatchEvent( event );

			expect( spy ).not.toHaveBeenCalled();
		} );
	} );

	describe( 'syncSharkCompact', () => {
		it( 'clears a swimming shark the instant the topbar stops showing (deck expands)', () => {
			mocks.context.sharkSwimming = true;
			mocks.context.sharkStartPct = 15;
			mocks.instance.konamiProgress = 3;

			mocks.context.compact = false;
			callbacks.syncSharkCompact();

			expect( mocks.context.sharkSwimming ).toBe( false );
			expect( mocks.context.sharkStartPct ).toBe( 0 );
			expect( mocks.instance.konamiProgress ).toBe( 0 );
		} );

		it( 'clears a swimming shark once the run ends', () => {
			mocks.context.sharkSwimming = true;

			mocks.context.running = false;
			callbacks.syncSharkCompact();

			expect( mocks.context.sharkSwimming ).toBe( false );
		} );

		it( 'leaves a swimming shark alone while still running and compact', () => {
			mocks.context.sharkSwimming = true;
			mocks.context.sharkStartPct = 15;

			callbacks.syncSharkCompact();

			expect( mocks.context.sharkSwimming ).toBe( true );
			expect( mocks.context.sharkStartPct ).toBe( 15 );
		} );

		it( 'no-ops while no shark is swimming', () => {
			expect( () => callbacks.syncSharkCompact() ).not.toThrow();
			expect( mocks.context.sharkSwimming ).toBe( false );
		} );
	} );

	describe( 'syncDevtoolsShark', () => {
		it( 'does not throw and touches nothing when no devtools slice is on shared state', () => {
			mocks.sharedState = {};

			expect( () => callbacks.syncDevtoolsShark() ).not.toThrow();
			expect( mocks.context.sharkSwimming ).toBe( false );
		} );

		it( 'mirrors launchable true when running && compact', () => {
			mocks.context.running = true;
			mocks.context.compact = true;

			callbacks.syncDevtoolsShark();

			expect( mocks.sharedState.devtools?.shark?.launchable ).toBe(
				true
			);
		} );

		it( 'mirrors launchable false when not running or not compact', () => {
			mocks.context.running = true;
			mocks.context.compact = false;

			callbacks.syncDevtoolsShark();

			expect( mocks.sharedState.devtools?.shark?.launchable ).toBe(
				false
			);
		} );

		it( 'launches the swim from a fresh launch.seq while launchable', () => {
			mocks.context.running = true;
			mocks.context.compact = true;
			mocks.sharedState.devtools!.shark!.launch = { seq: 1 };

			callbacks.syncDevtoolsShark();

			expect( mocks.context.sharkSwimming ).toBe( true );
		} );

		it( 'does not re-launch on a later re-run of the same already-consumed seq', () => {
			mocks.context.running = true;
			mocks.context.compact = true;
			mocks.sharedState.devtools!.shark!.launch = { seq: 1 };

			callbacks.syncDevtoolsShark();
			expect( mocks.context.sharkSwimming ).toBe( true );

			// The swim ends (as if its clear timer fired) and the same command
			// (still seq 1) is still sitting on shared state on a later,
			// unrelated re-run of the watch.
			mocks.context.sharkSwimming = false;
			callbacks.syncDevtoolsShark();

			expect( mocks.context.sharkSwimming ).toBe( false );
		} );

		it( 'clears a pending command and does not launch while not launchable', () => {
			mocks.context.running = false;
			mocks.context.compact = false;
			mocks.sharedState.devtools!.shark!.launch = { seq: 1 };

			callbacks.syncDevtoolsShark();

			expect( mocks.sharedState.devtools?.shark?.launch ).toBeNull();
			expect( mocks.context.sharkSwimming ).toBe( false );
		} );
	} );
} );
