/**
 * Tests for the drain-rate regression math.
 *
 * The consumer is the run session, which feeds it samples and binds the
 * resulting rates and projection. These tests verify the equations through that
 * surface: known slopes recover known rates, the guards return a null rate where
 * no slope exists, the window restricts the fit, and the projection inverts the
 * rate into minutes.
 */

import { describe, it, expect } from 'vitest';
import {
	drainRate,
	windowDrainRate,
	minutesToLevel,
	distinctLevelCount,
	WINDOW_MS,
	type Sample,
} from './DrainRate';

/**
 * A discharging sample at elapsed `t` ms and 0..1 `level`.
 * @param t
 * @param level
 * @param charging
 */
const s = ( t: number, level: number, charging = false ): Sample => ( {
	t,
	level,
	charging,
} );

describe( 'drainRate', () => {
	it( 'recovers a known slope as percentage points per hour', () => {
		// A 10% drop over exactly one hour is a 10 %/h drain.
		const result = drainRate( [ s( 0, 1.0 ), s( 3_600_000, 0.9 ) ] );

		expect( result.pctPerHour ).toBeCloseTo( 10, 6 );
		expect( result.samples ).toBe( 2 );
	} );

	it( 'fits a straight line through many points to the same rate', () => {
		const samples = [
			s( 0, 1.0 ),
			s( 900_000, 0.95 ),
			s( 1_800_000, 0.9 ),
			s( 2_700_000, 0.85 ),
			s( 3_600_000, 0.8 ),
		];

		// 20% over an hour → 20 %/h.
		expect( drainRate( samples ).pctPerHour ).toBeCloseTo( 20, 6 );
	} );

	it( 'returns a null rate with fewer than two samples', () => {
		expect( drainRate( [] ).pctPerHour ).toBeNull();
		expect( drainRate( [ s( 0, 1.0 ) ] ).pctPerHour ).toBeNull();
	} );

	it( 'returns a null rate when the level has not stepped yet', () => {
		// Two readings, but the same level: no slope is observable.
		const result = drainRate( [ s( 0, 0.8 ), s( 60_000, 0.8 ) ] );

		expect( result.pctPerHour ).toBeNull();
		expect( result.samples ).toBe( 2 );
	} );

	it( 'excludes charging samples from the fit', () => {
		// Only the two discharging points define the slope; the charging point
		// is dropped, leaving fewer than two distinct discharging levels.
		const result = drainRate( [ s( 0, 0.8 ), s( 60_000, 0.7, true ) ] );

		expect( result.pctPerHour ).toBeNull();
		expect( result.samples ).toBe( 1 );
	} );

	it( 'reports a positive rate while discharging', () => {
		expect(
			drainRate( [ s( 0, 0.5 ), s( 3_600_000, 0.4 ) ] ).pctPerHour
		).toBeGreaterThan( 0 );
	} );
} );

describe( 'windowDrainRate', () => {
	it( 'fits only the trailing window, ignoring older samples', () => {
		// First hour drains slowly (5 %/h), the last ten minutes fast (30 %/h).
		const samples = [
			s( 0, 1.0 ),
			s( 3_600_000, 0.95 ),
			s( 3_600_000 + WINDOW_MS, 0.9 ),
		];

		// Last 10 min: 5% over 10 min = 30 %/h.
		expect( windowDrainRate( samples ).pctPerHour ).toBeCloseTo( 30, 6 );
	} );

	it( 'returns a null rate for an empty log', () => {
		const result = windowDrainRate( [] );

		expect( result.pctPerHour ).toBeNull();
		expect( result.samples ).toBe( 0 );
	} );
} );

describe( 'minutesToLevel', () => {
	it( 'projects minutes to drop from one level to another', () => {
		// From 50% to empty at 10 %/h → 5 hours → 300 minutes.
		expect( minutesToLevel( 0.5, 0, 10 ) ).toBeCloseTo( 300, 6 );
	} );

	it( 'returns null when the rate is unknown or not draining', () => {
		expect( minutesToLevel( 0.5, 0, null ) ).toBeNull();
		expect( minutesToLevel( 0.5, 0, 0 ) ).toBeNull();
		expect( minutesToLevel( 0.5, 0, -4 ) ).toBeNull();
	} );

	it( 'returns null when the target is at or above the current level', () => {
		expect( minutesToLevel( 0.5, 0.5, 10 ) ).toBeNull();
		expect( minutesToLevel( 0.5, 0.8, 10 ) ).toBeNull();
	} );
} );

describe( 'distinctLevelCount', () => {
	it( 'counts unique levels regardless of how often each repeats', () => {
		expect(
			distinctLevelCount( [ s( 0, 0.8 ), s( 1, 0.8 ), s( 2, 0.7 ) ] )
		).toBe( 2 );
	} );
} );
