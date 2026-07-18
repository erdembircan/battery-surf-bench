/**
 * Tests for the bark model — the lifecycle behind the cockpit's behavior-start
 * pill. Pure over a plain context and instance, with injected fake timers, no
 * Interactivity runtime or DOM.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	pickBarkText,
	raiseBark,
	finishBark,
	clearBark,
	BARK_LEAVE_MS,
} from '@/cockpit/Barks';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type InstanceState } from '@/cockpit/RunInstance';

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
		barkGeneration: 0,
		barkStrings: STRINGS,
	} ) as unknown as CockpitContext;

/** An instance double holding a fresh bark state. */
const instance = (): InstanceState =>
	( {
		pendingBark: null,
		pendingDurationMs: null,
		barkDurationTimer: null,
		barkLeaveTimer: null,
	} ) as unknown as InstanceState;

describe( 'BARK_LEAVE_MS', () => {
	it( 'matches the CSS exit keyframe duration', () => {
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

		raiseBark( ctx, inst, 'readPause', 8000 );

		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( STRINGS.readPause ).toContain( ctx.barkText );
		expect( ctx.barkDurationMs ).toBe( 8000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
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

		raiseBark( ctx, inst, 'readPause', 8000 );
		const textAfterFirst = ctx.barkText;

		raiseBark( ctx, inst, 'readPause', 12000 );

		expect( ctx.barkText ).toBe( textAfterFirst );
		expect( ctx.barkDurationMs ).toBe( 8000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
		expect( inst.pendingBark ).toBeNull();
	} );

	it( 'ignores a new arrival for the key already pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 8000 );
		raiseBark( ctx, inst, 'lingerImage', 2000 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( inst.pendingDurationMs ).toBe( 2000 );

		// A second lingerImage arrival while it is already pending is a no-op.
		raiseBark( ctx, inst, 'lingerImage', 9999 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( inst.pendingDurationMs ).toBe( 2000 );
	} );

	it( 'a different key queues as pending and begins the showing bark’s leave immediately — no minimum on-screen time', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000 );
		raiseBark( ctx, inst, 'lingerImage', 3000 );

		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( inst.pendingDurationMs ).toBe( 3000 );
		// Still readPause showing, but already leaving — synchronously, with
		// no wait of any kind.
		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( ctx.barkPhase ).toBe( 'leaving' );
	} );

	it( 'the queued bark shows only once the leave animation finishes', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000 );
		raiseBark( ctx, inst, 'lingerImage', 3000 );

		vi.advanceTimersByTime( BARK_LEAVE_MS - 1 );
		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		vi.advanceTimersByTime( 1 );
		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkDurationMs ).toBe( 3000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );

	it( 'keeps only the newest of several arrivals that queue behind one showing bark', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000 );
		raiseBark( ctx, inst, 'lingerImage', 3000 );
		raiseBark( ctx, inst, 'moveOn', 2500 );

		expect( inst.pendingBark ).toBe( 'moveOn' );
		expect( inst.pendingDurationMs ).toBe( 2500 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkBehavior ).toBe( 'moveOn' );
		expect( ctx.barkDurationMs ).toBe( 2500 );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );

	it( 'a new arrival while the showing bark is already leaving still queues, without restarting the leave', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		vi.advanceTimersByTime( 1000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		// Arrives partway through the leave animation.
		vi.advanceTimersByTime( 100 );
		raiseBark( ctx, inst, 'lingerImage', 3000 );
		expect( inst.pendingBark ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		// The leave finishes at its ORIGINAL time (100ms already elapsed, not
		// restarted from the new arrival) — proof the arrival didn't reset it.
		vi.advanceTimersByTime( BARK_LEAVE_MS - 100 );
		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );

	it( 'a completed-duration bark (no interruption) leaves on its own and finishes', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 5000 );
		vi.advanceTimersByTime( 4999 );
		expect( ctx.barkPhase ).toBe( 'entering' );

		vi.advanceTimersByTime( 1 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkPhase ).toBe( '' );
	} );
} );

describe( 'barkGeneration', () => {
	beforeEach( () => vi.useFakeTimers() );
	afterEach( () => vi.useRealTimers() );

	it( 'advances every time a bark is shown, including a repeat of the same key/duration', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'moveOn', 2500 );
		const firstGeneration = ctx.barkGeneration;

		// The same key finishes fully (idle), then barks again with the exact
		// same duration — the two consecutive shows of an identical key +
		// duration must still be distinguishable, since a mere duration
		// comparison can't tell them apart (this is exactly the case the
		// tide's animation-restart guarantee depends on).
		vi.advanceTimersByTime( 2500 + BARK_LEAVE_MS );
		expect( ctx.barkBehavior ).toBe( '' );

		raiseBark( ctx, inst, 'moveOn', 2500 );

		expect( ctx.barkGeneration ).not.toBe( firstGeneration );
	} );

	it( 'advances again when finishBark pumps a queued bark, sharing the same duration value as the one that just left', () => {
		const ctx = context();
		const inst = instance();

		// A different key that happens to share moveOn's fixed duration —
		// same-key queueing behind itself is impossible (the dedupe check
		// blocks a repeat of the key currently showing from ever queuing),
		// so a shared *duration* with a different key is the realistic shape
		// of this edge case for the queued/pumped path specifically.
		raiseBark( ctx, inst, 'moveOn', 2500 );
		const firstGeneration = ctx.barkGeneration;

		raiseBark( ctx, inst, 'readPause', 2500 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( ctx.barkDurationMs ).toBe( 2500 );
		expect( ctx.barkGeneration ).not.toBe( firstGeneration );
	} );
} );

describe( 'finishBark', () => {
	it( 'clears the context and shows the pending bark fresh', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 20000 );
		raiseBark( ctx, inst, 'lingerImage', 3000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		finishBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkDurationMs ).toBe( 3000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
		expect( inst.pendingBark ).toBeNull();
		expect( inst.pendingDurationMs ).toBeNull();
	} );

	it( 'leaves the pill idle when nothing is pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		finishBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkDurationMs ).toBe( 0 );
		expect( ctx.barkPhase ).toBe( '' );
	} );

	it( 'lets the same key bark again once it has finished — same-key suppression only applies while showing or pending', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		finishBark( ctx, inst );
		expect( ctx.barkBehavior ).toBe( '' );

		raiseBark( ctx, inst, 'readPause', 1000 );

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

		raiseBark( ctx, inst, 'readPause', 20000 );
		raiseBark( ctx, inst, 'lingerImage', 3000 );

		clearBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkDurationMs ).toBe( 0 );
		expect( ctx.barkPhase ).toBe( '' );
		expect( inst.pendingBark ).toBeNull();
		expect( inst.pendingDurationMs ).toBeNull();
		expect( inst.barkDurationTimer ).toBeNull();
		expect( inst.barkLeaveTimer ).toBeNull();

		// The cleared timers must not fire later and resurrect a phase.
		vi.advanceTimersByTime( 20000 + BARK_LEAVE_MS );
		expect( ctx.barkPhase ).toBe( '' );
		expect( ctx.barkBehavior ).toBe( '' );
	} );

	it( 'clears a bark that was already leaving, cancelling its leave timer too', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		vi.advanceTimersByTime( 1000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		clearBark( ctx, inst );

		expect( ctx.barkPhase ).toBe( '' );
		expect( inst.barkLeaveTimer ).toBeNull();

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkPhase ).toBe( '' );
	} );
} );
