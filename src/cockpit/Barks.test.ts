/**
 * Tests for the bark model — the lifecycle behind the cockpit's behavior-start
 * pill. Pure over a plain context and instance, with injected fake timers and a
 * controllable clock/rng, no Interactivity runtime or DOM.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	pickBarkText,
	raiseBark,
	finishBark,
	clearBark,
	BARK_HOLD_MS,
	BARK_SAFE_MS,
} from './Barks';
import { type CockpitContext } from './CockpitContext';
import { type InstanceState } from './RunInstance';

const STRINGS: Record< string, string[] > = {
	readPause: [ 'Deep in the good words…', 'Catching up on the fine print…' ],
	lingerImage: [
		'Basking in the beauty of the pictures…',
		'Ooh, shiny pixels…',
	],
	moveOn: [
		'Paddling off to the next page…',
		'This wave is done — surfing on…',
	],
};

/** A context double carrying only the bark fields the model touches. */
const context = (): CockpitContext =>
	( {
		barkBehavior: '',
		barkText: '',
		barkPhase: '',
		barkStrings: STRINGS,
	} ) as unknown as CockpitContext;

/** An instance double holding a fresh bark state. */
const instance = (): InstanceState =>
	( {
		pendingBark: null,
		barkTimer: null,
		barkReplaceTimer: null,
		barkShownAt: null,
	} ) as unknown as InstanceState;

describe( 'BARK_HOLD_MS / BARK_SAFE_MS', () => {
	it( 'holds for six seconds with a 2.5s safe period', () => {
		expect( BARK_HOLD_MS ).toBe( 6000 );
		expect( BARK_SAFE_MS ).toBe( 2500 );
	} );
} );

describe( 'pickBarkText', () => {
	it( 'picks the first variant when the rng draws near 0', () => {
		expect( pickBarkText( STRINGS, 'readPause', () => 0 ) ).toBe(
			'Deep in the good words…'
		);
	} );

	it( 'picks the second variant when the rng draws near 1', () => {
		expect( pickBarkText( STRINGS, 'readPause', () => 0.999 ) ).toBe(
			'Catching up on the fine print…'
		);
	} );

	it( 'returns an empty string for a key with no strings entry', () => {
		expect( pickBarkText( STRINGS, 'scrollBurst', () => 0 ) ).toBe( '' );
	} );
} );

describe( 'raiseBark', () => {
	afterEach( () => {
		vi.useRealTimers();
	} );

	it( 'shows immediately when the pill is free', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );

		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( STRINGS.readPause ).toContain( ctx.barkText );
		expect( ctx.barkPhase ).toBe( 'entering' );
		expect( inst.barkShownAt ).toBe( 1000 );
	} );

	it( 'is a no-op for a key with no strings entry (non-barking behavior)', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'scrollBurst', 1000 );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( inst.pendingBark ).toBeNull();
	} );

	it( 'ignores a new arrival for the key already showing', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		const textAfterFirst = ctx.barkText;
		raiseBark( ctx, inst, 'readPause', 1200 );

		expect( ctx.barkText ).toBe( textAfterFirst );
		expect( inst.barkShownAt ).toBe( 1000 );
		expect( inst.pendingBark ).toBeNull();
	} );

	it( 'ignores a new arrival for the key already pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		// Inside the safe period: lingerImage becomes pending.
		raiseBark( ctx, inst, 'lingerImage', 1200 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );

		// A second lingerImage arrival while it is already pending is a no-op.
		raiseBark( ctx, inst, 'lingerImage', 1300 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );
	} );

	it( 'stores a new key as pending inside the safe period without changing what shows yet', () => {
		vi.useFakeTimers();
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 0 );
		raiseBark( ctx, inst, 'lingerImage', 500 );

		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( ctx.barkPhase ).toBe( 'entering' );

		// The replace timer fires at the safe period's end and starts the leave.
		vi.advanceTimersByTime( BARK_SAFE_MS - 500 );
		expect( ctx.barkPhase ).toBe( 'leaving' );
	} );

	it( 'keeps only the newest of several arrivals inside the safe period', () => {
		vi.useFakeTimers();
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 0 );
		raiseBark( ctx, inst, 'lingerImage', 400 );
		raiseBark( ctx, inst, 'moveOn', 800 );

		expect( inst.pendingBark ).toBe( 'moveOn' );

		vi.advanceTimersByTime( BARK_SAFE_MS );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		finishBark( ctx, inst );
		expect( ctx.barkBehavior ).toBe( 'moveOn' );
	} );

	it( 'replaces immediately (pending + leaving) once the safe period has elapsed', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 0 );
		raiseBark( ctx, inst, 'lingerImage', BARK_SAFE_MS + 50 );

		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'leaving' );
	} );
} );

describe( 'finishBark', () => {
	it( 'clears the context and shows the pending bark fresh', () => {
		// finishBark has no injectable `now` (per its public signature), so it
		// reads performance.now() directly; spy on it rather than faking timers.
		vi.spyOn( performance, 'now' ).mockReturnValue( 5000 );
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 0 );
		raiseBark( ctx, inst, 'lingerImage', BARK_SAFE_MS + 50 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		finishBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'entering' );
		expect( inst.pendingBark ).toBeNull();
		expect( inst.barkShownAt ).toBe( 5000 );

		vi.restoreAllMocks();
	} );

	it( 'leaves the pill idle when nothing is pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 0 );
		finishBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkPhase ).toBe( '' );
	} );

	it( 'lets the same key bark again once it has finished — same-key suppression only applies while showing or pending', () => {
		const ctx = context();
		const inst = instance();

		// A behavior's first win shows, then finishes entirely (no bark
		// showing or pending) before the same behavior wins again — a long
		// dwell's heartbeat re-notification is exactly this shape.
		raiseBark( ctx, inst, 'readPause', 0 );
		finishBark( ctx, inst );
		expect( ctx.barkBehavior ).toBe( '' );

		raiseBark( ctx, inst, 'readPause', 10_000 );

		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );
} );

describe( 'clearBark', () => {
	beforeEach( () => vi.useFakeTimers() );
	afterEach( () => vi.useRealTimers() );

	it( 'clears the showing bark, the pending slot, and every timer', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 0 );
		raiseBark( ctx, inst, 'lingerImage', 500 );
		inst.barkTimer = setTimeout(
			() => undefined,
			BARK_HOLD_MS
		) as unknown as number;

		clearBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkPhase ).toBe( '' );
		expect( inst.pendingBark ).toBeNull();
		expect( inst.barkTimer ).toBeNull();
		expect( inst.barkReplaceTimer ).toBeNull();

		// The cleared replace timer must not fire later and resurrect a phase.
		vi.advanceTimersByTime( BARK_SAFE_MS );
		expect( ctx.barkPhase ).toBe( '' );
	} );
} );
