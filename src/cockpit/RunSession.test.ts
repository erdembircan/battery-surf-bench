/**
 * Tests for the run-session calculation model.
 *
 * The consumer is the store, which starts a session, feeds it readings with an
 * explicit clock, and reads back the derived rates and projection. These tests
 * drive that surface: readouts stay null until a slope exists, a known drain
 * recovers known readouts, recording is gated on an active run, and starting
 * resets prior samples.
 */

import { describe, it, expect } from 'vitest';
import { RunSession } from './RunSession';

describe( 'RunSession', () => {
	it( 'is inactive until started and active afterwards', () => {
		const session = new RunSession();
		expect( session.active ).toBe( false );

		session.start( 0 );
		expect( session.active ).toBe( true );

		session.stop();
		expect( session.active ).toBe( false );
	} );

	it( 'reports null readouts before a slope is observable', () => {
		const session = new RunSession();
		session.start( 0 );

		// No samples yet.
		expect( session.readouts() ).toEqual( {
			rate10: null,
			rateSession: null,
			secondsToEmpty: null,
		} );

		// One plateau is still not a slope.
		session.record( 0, 0.8, false );
		expect( session.readouts().rateSession ).toBeNull();
	} );

	it( 'derives known readouts from a known drain', () => {
		const session = new RunSession();
		session.start( 1_000 );

		// 1% drop over ten minutes → 6 %/h. Timestamps are relative to start.
		session.record( 1_000, 0.8, false );
		session.record( 1_000 + 600_000, 0.79, false );

		const readouts = session.readouts();
		expect( readouts.rateSession ).toBe( 6 );
		expect( readouts.rate10 ).toBe( 6 );
		// Full-charge runtime: 100% at 6 %/h → 1000 minutes → 60,000 seconds,
		// independent of the level the run is currently at.
		expect( readouts.secondsToEmpty ).toBe( 60_000 );
	} );

	it( 'rounds the rate to a tenth of a percent per hour', () => {
		const session = new RunSession();
		session.start( 0 );

		// 1% over seven minutes → 8.571… %/h → 8.6.
		session.record( 0, 0.8, false );
		session.record( 420_000, 0.79, false );

		expect( session.readouts().rateSession ).toBe( 8.6 );
	} );

	it( 'ignores readings recorded while inactive', () => {
		const session = new RunSession();

		session.record( 0, 0.8, false );
		session.record( 600_000, 0.79, false );

		expect( session.readouts().rateSession ).toBeNull();
	} );

	it( 'discards prior samples when a new run starts', () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.8, false );
		session.record( 600_000, 0.79, false );
		expect( session.readouts().rateSession ).toBe( 6 );

		session.start( 0 );
		expect( session.readouts().rateSession ).toBeNull();
	} );

	it( 'has no summary before any sample is recorded', () => {
		const session = new RunSession();
		session.start( 0 );
		expect( session.summary() ).toBeNull();
	} );

	it( 'summarizes the start, end, drop and readouts of a run', () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600_000, 0.75, false );

		const summary = session.summary();
		expect( summary ).not.toBeNull();
		expect( summary!.startLevel ).toBe( 0.82 );
		expect( summary!.endLevel ).toBe( 0.75 );
		expect( summary!.droppedPct ).toBeCloseTo( 7, 6 );
		expect( summary!.rateSession ).not.toBeNull();
	} );

	it( 'keeps the summary readable after the run stops', () => {
		const session = new RunSession();
		session.start( 0 );
		session.record( 0, 0.82, false );
		session.record( 600_000, 0.75, false );
		session.stop();

		expect( session.summary()?.droppedPct ).toBeCloseTo( 7, 6 );
	} );
} );
