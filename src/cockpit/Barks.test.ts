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

	it( 'shows immediately with the announced duration', () => {
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
	} );

	it( 'ignores a repeat arrival for the key already showing (still entering)', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 8000 );
		const textAfterFirst = ctx.barkText;
		const durationAfterFirst = ctx.barkDurationMs;

		raiseBark( ctx, inst, 'readPause', 12000 );

		expect( ctx.barkText ).toBe( textAfterFirst );
		expect( ctx.barkDurationMs ).toBe( durationAfterFirst );
	} );

	it( 'replaces a different key immediately while the current one is still entering', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 8000 );
		raiseBark( ctx, inst, 'lingerImage', 2000 );

		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkDurationMs ).toBe( 2000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );

	it( 'replaces immediately even while the current bark is leaving', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		vi.advanceTimersByTime( 1000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		raiseBark( ctx, inst, 'lingerImage', 3000 );

		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );

	it( 'lets the same key bark again once it is leaving — dedupe only applies while entering', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 1000 );
		vi.advanceTimersByTime( 1000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		raiseBark( ctx, inst, 'readPause', 5000 );

		expect( ctx.barkBehavior ).toBe( 'readPause' );
		expect( ctx.barkDurationMs ).toBe( 5000 );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );

	it( 'arms a leave after the announced duration elapses', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 5000 );
		vi.advanceTimersByTime( 4999 );
		expect( ctx.barkPhase ).toBe( 'entering' );

		vi.advanceTimersByTime( 1 );
		expect( ctx.barkPhase ).toBe( 'leaving' );
	} );

	it( 'finishes (clears) after the leave duration elapses following the duration timer', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 5000 );
		vi.advanceTimersByTime( 5000 );
		expect( ctx.barkPhase ).toBe( 'leaving' );

		vi.advanceTimersByTime( BARK_LEAVE_MS );
		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkPhase ).toBe( '' );
	} );

	it( 'a replacement cancels the old duration timer — it never fires a stale leave', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 5000 );
		vi.advanceTimersByTime( 1000 );

		raiseBark( ctx, inst, 'lingerImage', 5000 );

		// The old readPause duration timer would have fired at 5000ms total;
		// advancing past that must not touch the new lingerImage bark, which
		// has its own fresh 5000ms timer counted from the replace.
		vi.advanceTimersByTime( 4000 );
		expect( ctx.barkBehavior ).toBe( 'lingerImage' );
		expect( ctx.barkPhase ).toBe( 'entering' );
	} );
} );

describe( 'finishBark', () => {
	it( 'clears the context back to its idle shape', () => {
		const ctx = context();
		const inst = instance();

		ctx.barkBehavior = 'readPause';
		ctx.barkText = 'Deep in the good words…';
		ctx.barkDurationMs = 5000;
		ctx.barkPhase = 'leaving';

		finishBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkDurationMs ).toBe( 0 );
		expect( ctx.barkPhase ).toBe( '' );
	} );
} );

describe( 'clearBark', () => {
	beforeEach( () => vi.useFakeTimers() );
	afterEach( () => vi.useRealTimers() );

	it( 'clears the showing bark and every timer', () => {
		const ctx = context();
		const inst = instance();

		raiseBark( ctx, inst, 'readPause', 5000 );

		clearBark( ctx, inst );

		expect( ctx.barkBehavior ).toBe( '' );
		expect( ctx.barkText ).toBe( '' );
		expect( ctx.barkDurationMs ).toBe( 0 );
		expect( ctx.barkPhase ).toBe( '' );
		expect( inst.barkDurationTimer ).toBeNull();
		expect( inst.barkLeaveTimer ).toBeNull();

		// The cleared duration timer must not fire later and resurrect a phase.
		vi.advanceTimersByTime( 5000 + BARK_LEAVE_MS );
		expect( ctx.barkPhase ).toBe( '' );
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
