/**
 * Tests for the shark-fin swim model — the lifecycle behind the cockpit's
 * Konami-code Easter egg. Pure over a plain context and instance, with
 * injected fake timers and an injected rng, no Interactivity runtime or DOM.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	planSwim,
	launchShark,
	clearShark,
	SHARK_SURFACE_MS,
	SHARK_DIVE_MS,
	SHARK_FULL_CROSS_MS,
	SHARK_TRAIL_MAX_DELAY_MS,
} from './Shark';
import { type CockpitContext } from './CockpitContext';
import { type InstanceState } from './RunInstance';

/** A context double carrying only the shark fields the model touches. */
const context = (): CockpitContext =>
	( {
		sharkSwimming: false,
		sharkStartPct: 0,
		sharkEndPct: 0,
		sharkTotalMs: 0,
	} ) as unknown as CockpitContext;

/** An instance double holding a fresh shark/Konami state. */
const instance = (): InstanceState =>
	( {
		sharkTimer: null,
		konamiProgress: 4,
		konamiLastKeyAt: 1000,
	} ) as unknown as InstanceState;

describe( 'the shark’s fixed timings', () => {
	it( 'match the CSS keyframe durations', () => {
		expect( SHARK_SURFACE_MS ).toBe( 950 );
		expect( SHARK_DIVE_MS ).toBe( 750 );
	} );

	it( 'SHARK_FULL_CROSS_MS is the full-lane cruise time at 1× speed', () => {
		expect( SHARK_FULL_CROSS_MS ).toBe( 15000 );
	} );

	it( 'SHARK_TRAIL_MAX_DELAY_MS matches the last trail ghost’s delay', () => {
		expect( SHARK_TRAIL_MAX_DELAY_MS ).toBe( 420 );
	} );
} );

describe( 'planSwim', () => {
	it( 'surfaces in the left 2–26% of the lane at the low rng extreme', () => {
		const plan = planSwim( 1, () => 0 );
		expect( plan.startPct ).toBe( 2 );
	} );

	it( 'surfaces near the top of its range at the high rng extreme', () => {
		const plan = planSwim( 1, () => 0.999999 );
		expect( plan.startPct ).toBeCloseTo( 26, 1 );
	} );

	it( 'dives in the right 70–97% of the lane at the low rng extreme', () => {
		// The rng is called twice (start, then end); feed the same value to
		// both so the end draw also sits at its own low extreme.
		const plan = planSwim( 1, () => 0 );
		expect( plan.endPct ).toBe( 70 );
	} );

	it( 'dives near the top of its range at the high rng extreme', () => {
		const plan = planSwim( 1, () => 0.999999 );
		expect( plan.endPct ).toBeCloseTo( 97, 1 );
	} );

	it( 'totals surface + cruise + dive', () => {
		// Fixed draws: startPct = 2 + 0.5*24 = 14, endPct = 70 + 0.5*27 = 83.5.
		const plan = planSwim( 1, () => 0.5 );
		const expectedCruiseMs =
			( ( plan.endPct - plan.startPct ) / 100 ) * SHARK_FULL_CROSS_MS;

		expect( plan.totalMs ).toBe(
			Math.round( SHARK_SURFACE_MS + expectedCruiseMs + SHARK_DIVE_MS )
		);
	} );

	it( 'scales the cruise by the square root of speed — 4× speed halves it', () => {
		const rng = () => 0.5;
		const at1x = planSwim( 1, rng );
		const at4x = planSwim( 4, rng );

		const cruise1x = at1x.totalMs - SHARK_SURFACE_MS - SHARK_DIVE_MS;
		const cruise4x = at4x.totalMs - SHARK_SURFACE_MS - SHARK_DIVE_MS;

		// Both totals are independently rounded to the nearest millisecond, so
		// allow a whisker of slack rather than asserting bit-exact halving.
		expect( Math.abs( cruise4x - cruise1x / 2 ) ).toBeLessThanOrEqual( 1 );
	} );

	it( 'never scales UP the cruise for a sub-1 speed (clamped at 1)', () => {
		const rng = () => 0.5;
		const at1x = planSwim( 1, rng );
		const atHalf = planSwim( 0.5, rng );

		expect( atHalf.totalMs ).toBe( at1x.totalMs );
	} );
} );

describe( 'launchShark', () => {
	beforeEach( () => vi.useFakeTimers() );
	afterEach( () => vi.useRealTimers() );

	it( 'writes the planned swim onto the context and marks it swimming', () => {
		const ctx = context();
		const inst = instance();

		launchShark( ctx, inst, 1, () => 0.5 );

		expect( ctx.sharkSwimming ).toBe( true );
		expect( ctx.sharkStartPct ).toBeGreaterThan( 0 );
		expect( ctx.sharkEndPct ).toBeGreaterThan( ctx.sharkStartPct );
		expect( ctx.sharkTotalMs ).toBeGreaterThan( 0 );
	} );

	it( 'is a no-op while a shark is already swimming', () => {
		const ctx = context();
		ctx.sharkSwimming = true;
		ctx.sharkStartPct = 5;
		ctx.sharkEndPct = 90;
		ctx.sharkTotalMs = 4321;
		const inst = instance();

		launchShark( ctx, inst, 1, () => 0.1 );

		expect( ctx.sharkStartPct ).toBe( 5 );
		expect( ctx.sharkEndPct ).toBe( 90 );
		expect( ctx.sharkTotalMs ).toBe( 4321 );
	} );

	it( 'arms a timer that clears the swim after totalMs plus the trail’s max delay', () => {
		const ctx = context();
		const inst = instance();

		launchShark( ctx, inst, 1, () => 0.5 );
		const totalMs = ctx.sharkTotalMs;

		vi.advanceTimersByTime( totalMs + SHARK_TRAIL_MAX_DELAY_MS - 1 );
		expect( ctx.sharkSwimming ).toBe( true );

		vi.advanceTimersByTime( 1 );
		expect( ctx.sharkSwimming ).toBe( false );
		expect( ctx.sharkStartPct ).toBe( 0 );
		expect( ctx.sharkEndPct ).toBe( 0 );
		expect( ctx.sharkTotalMs ).toBe( 0 );
		expect( inst.sharkTimer ).toBeNull();
	} );
} );

describe( 'clearShark', () => {
	beforeEach( () => vi.useFakeTimers() );
	afterEach( () => vi.useRealTimers() );

	it( 'cancels the timer, resets Konami progress/timestamp, and zeroes the plan', () => {
		const ctx = context();
		const inst = instance();

		launchShark( ctx, inst, 1, () => 0.5 );
		expect( inst.sharkTimer ).not.toBeNull();

		clearShark( ctx, inst );

		expect( ctx.sharkSwimming ).toBe( false );
		expect( ctx.sharkStartPct ).toBe( 0 );
		expect( ctx.sharkEndPct ).toBe( 0 );
		expect( ctx.sharkTotalMs ).toBe( 0 );
		expect( inst.sharkTimer ).toBeNull();
		expect( inst.konamiProgress ).toBe( 0 );
		expect( inst.konamiLastKeyAt ).toBeNull();

		// The cancelled timer must never fire later and resurrect the swim.
		vi.advanceTimersByTime( 60000 );
		expect( ctx.sharkSwimming ).toBe( false );
	} );

	it( 'is idempotent — safe to call with nothing swimming', () => {
		const ctx = context();
		const inst = instance();

		expect( () => clearShark( ctx, inst ) ).not.toThrow();
		expect( ctx.sharkSwimming ).toBe( false );
	} );
} );
