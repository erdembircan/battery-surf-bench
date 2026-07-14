/**
 * Tests for the bark model — the lifecycle behind the cockpit's behavior-start
 * pill. Pure over a plain context and instance, with injected fake timers and
 * explicit `now` values, no Interactivity runtime or DOM.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	pickBarkText,
	raiseBark,
	finishBark,
	clearBark,
	BARK_SAFE_MS,
	BARK_LEAVE_MS,
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
		barkDurationMs: 0,
		barkPhase: '',
		barkStrings: STRINGS,
	} ) as unknown as CockpitContext;

/** An instance double holding a fresh bark state. */
const instance = (): InstanceState =>
	( {
		pendingBark: null,
		pendingDurationMs: null,
		barkShownAt: null,
		barkDurationTimer: null,
		barkReplaceTimer: null,
		barkLeaveTimer: null,
	} ) as unknown as InstanceState;

describe( 'BARK_SAFE_MS / BARK_LEAVE_MS', () => {
	it( 'holds a 2.5s safe period and a 320ms leave, matching the CSS exit keyframe', () => {
		expect( BARK_SAFE_MS ).toBe( 2500 );
		expect( BARK_LEAVE_MS ).toBe( 320 );
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
	beforeEach( () => vi.useFakeTimers() );
	afterEach( () => vi.useRealTimers() );

	it( 'shows immediately when the pill is free, with the announced duration', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 8000, 1000 );

		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( STRINGS.readPause ).toContain( ctx.barkText );
		expect( ctx.barkDurationMs ).toBe( 8000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
		expect( inst.barkShownAt ).toBe( 1000 );
	} );

	it( 'is a no-op for a key with no strings entry (non-barking behavior)', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'scrollBurst', 1000, 0 );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( inst.pendingBark ).toBeNull();
	} );

	it( 'ignores a new arrival for the key already showing', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 8000, 1000 );
		const textAfterFirst = ctx.barkText;

		raiseBark( ctx, inst, 'readPause', 12000, 1200 );

		expect( ctx.barkText ).toBe( textAfterFirst );
		expect( ctx.barkDurationMs ).toBe( 8000 );
		expect( inst.barkShownAt ).toBe( 1000 );
		expect( inst.pendingBark ).toBeNull();
	} );

	it( 'ignores a new arrival for the key already pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 8000, 0 );
		// Inside the safe period: lingerImage becomes pending.
		raiseBark( ctx, inst, 'lingerImage', 2000, 200 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( inst.pendingDurationMs ).toBe( 2000 );

		// A second lingerImage arrival while it is already pending is a no-op.
		raiseBark( ctx, inst, 'lingerImage', 9999, 300 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( inst.pendingDurationMs ).toBe( 2000 );
	} );

	it( 'stores a new key as pending inside the safe period without changing what shows yet', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000, 0 );
		raiseBark( ctx, inst, 'lingerImage', 3000, 500 );

		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( inst.pendingDurationMs ).toBe( 3000 );
		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( ctx.barkDurationMs ).toBe( 20000 );
		expect( ctx.barkPhase ).toBe( 'entering' );

		// The replace timer fires at the safe period's end and starts the leave.
		vi.advanceTimersByTime( BARK_SAFE_MS - 500 );
		expect( ctx.barkPhase ).toBe( 'leaving' );
	} );

	it( 'keeps only the newest of several arrivals inside the safe period', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000, 0 );
		raiseBark( ctx, inst, 'lingerImage', 3000, 400 );
		raiseBark( ctx, inst, 'moveOn', 2500, 800 );

		expect( inst.pendingBark ).toBe( 'moveOn' );
		expect( inst.pendingDurationMs ).toBe( 2500 );

		// The replace timer was armed off the LAST arrival's own elapsed time
		// (800ms in), so it fires at the safe period's end measured from
		// there — BARK_SAFE_MS - 800 — not a full BARK_SAFE_MS later.
		vi.advanceTimersByTime( BARK_SAFE_MS - 800 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkBehavior ).toBe( 'moveOn' );
		expect( ctx.barkDurationMs ).toBe( 2500 );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );

	it( 'begins the leave immediately (pending set) once the safe period has already elapsed', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000, 0 );
		raiseBark( ctx, inst, 'lingerImage', 3000, BARK_SAFE_MS + 50 );

		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'leaving' );
	} );

	it( 'a natural duration-timer leave (current bark shorter than the safe period) still queues and pumps a pending arrival', () => {
		const ctx = context();
		const inst = instance();

		// A short-dwelling bark: its own duration timer fires well before the
		// safe period would have ended.
		raiseBark( ctx, inst, 'readPause', 1000, 0 );
		raiseBark( ctx, inst, 'lingerImage', 3000, 500 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );

		// The natural duration timer fires at 1000ms, well inside the safe
		// period (which wouldn't end until 2500ms) — the current bark still
		// leaves and pumps the pending one; the stale replace timer must not
		// later cut the newly-shown pending bark's own safe period short.
		vi.advanceTimersByTime( 1000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'entering' );

		// The stale replace timer (armed for the remainder of readPause's
		// safe period, ~2000ms more) must not fire and cut lingerImage's own
		// fresh entering short.
		vi.advanceTimersByTime( 2000 );
		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );
} );

describe( 'finishBark', () => {
	it( 'clears the context and shows the pending bark fresh', () => {
		// finishBark has no injectable `now` (per its public signature), so it
		// reads performance.now() directly; spy on it rather than faking timers.
		vi.spyOn( performance, 'now' ).mockReturnValue( 5000 );
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000, 0 );
		raiseBark( ctx, inst, 'lingerImage', 3000, BARK_SAFE_MS + 50 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		finishBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkDurationMs ).toBe( 3000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
		expect( inst.pendingBark ).toBeNull();
		expect( inst.pendingDurationMs ).toBeNull();
		expect( inst.barkShownAt ).toBe( 5000 );

		vi.restoreAllMocks();
	} );

	it( 'leaves the pill idle when nothing is pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000, 0 );
		finishBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkDurationMs ).toBe( 0 );
		expect( ctx.barkPhase ).toBe( '' );
	} );

	it( 'lets the same key bark again once it has finished — same-key suppression only applies while showing or pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000, 0 );
		finishBark( ctx, inst );
		expect( ctx.barkBehavior ).toBe( '' );

		raiseBark( ctx, inst, 'readPause', 1000, 10_000 );

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

		raiseBark( ctx, inst, 'readPause', 20000, 0 );
		raiseBark( ctx, inst, 'lingerImage', 3000, 500 );

		clearBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkDurationMs ).toBe( 0 );
		expect( ctx.barkPhase ).toBe( '' );
		expect( inst.pendingBark ).toBeNull();
		expect( inst.pendingDurationMs ).toBeNull();
		expect( inst.barkDurationTimer ).toBeNull();
		expect( inst.barkReplaceTimer ).toBeNull();
		expect( inst.barkLeaveTimer ).toBeNull();

		// The cleared timers must not fire later and resurrect a phase.
		vi.advanceTimersByTime( 20000 + BARK_SAFE_MS + BARK_LEAVE_MS );
		expect( ctx.barkPhase ).toBe( '' );
		expect( ctx.barkBehavior ).toBe( '' );
	} );

	it( 'clears a bark that was already leaving, cancelling its leave timer too', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000, 0 );
		vi.advanceTimersByTime( 1000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		clearBark( ctx, inst );

		expect( ctx.barkPhase ).toBe( '' );
		expect( inst.barkLeaveTimer ).toBeNull();

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkPhase ).toBe( '' );
	} );
} );
