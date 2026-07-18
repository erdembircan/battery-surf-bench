/**
 * Tests for the discharge-simulation sub-tool's pure model.
 */

import { describe, it, expect } from 'vitest';
import {
	simDurationMs,
	simProgress,
	simulatedLevel,
	isSimComplete,
	simRemainingMs,
	type DischargeSimConfig,
} from '@/devtools/DischargeSim';

const config = (
	partial: Partial< DischargeSimConfig > = {}
): DischargeSimConfig => ( {
	fromPercent: 90,
	toPercent: 20,
	minutes: 30,
	...partial,
} );

describe( 'simDurationMs', () => {
	it( 'converts minutes to milliseconds', () => {
		expect( simDurationMs( config( { minutes: 30 } ) ) ).toBe( 1_800_000 );
		expect( simDurationMs( config( { minutes: 5 } ) ) ).toBe( 300_000 );
	} );
} );

describe( 'simProgress', () => {
	it( 'is 0 at the start and 1 at the end', () => {
		const cfg = config( { minutes: 10 } );
		expect( simProgress( cfg, 0 ) ).toBe( 0 );
		expect( simProgress( cfg, simDurationMs( cfg ) ) ).toBe( 1 );
	} );

	it( 'is exactly proportional at the midpoint', () => {
		const cfg = config( { minutes: 10 } );
		expect( simProgress( cfg, simDurationMs( cfg ) / 2 ) ).toBeCloseTo(
			0.5
		);
	} );

	it( 'clamps to 1 past the end', () => {
		const cfg = config( { minutes: 10 } );
		expect( simProgress( cfg, simDurationMs( cfg ) * 2 ) ).toBe( 1 );
	} );

	it( 'clamps to 0 for a negative elapsed time', () => {
		expect( simProgress( config(), -1000 ) ).toBe( 0 );
	} );
} );

describe( 'simulatedLevel', () => {
	it( 'is exactly the start level at elapsed 0', () => {
		const cfg = config( { fromPercent: 90, toPercent: 20, minutes: 30 } );
		expect( simulatedLevel( cfg, 0 ) ).toBeCloseTo( 0.9 );
	} );

	it( 'is exactly the end level once the duration has elapsed', () => {
		const cfg = config( { fromPercent: 90, toPercent: 20, minutes: 30 } );
		expect( simulatedLevel( cfg, simDurationMs( cfg ) ) ).toBeCloseTo(
			0.2
		);
	} );

	it( 'clamps to the end level past the duration — never overshoots', () => {
		const cfg = config( { fromPercent: 90, toPercent: 20, minutes: 30 } );
		expect( simulatedLevel( cfg, simDurationMs( cfg ) * 3 ) ).toBeCloseTo(
			0.2
		);
	} );

	it( 'interpolates linearly at the midpoint', () => {
		const cfg = config( { fromPercent: 100, toPercent: 0, minutes: 10 } );
		expect( simulatedLevel( cfg, simDurationMs( cfg ) / 2 ) ).toBeCloseTo(
			0.5
		);
	} );

	it( 'interpolates linearly at an arbitrary fraction', () => {
		const cfg = config( { fromPercent: 90, toPercent: 20, minutes: 30 } );
		// 25% through a 90 → 20 run: 90 - 70 * 0.25 = 72.5 → 0.725.
		expect(
			simulatedLevel( cfg, simDurationMs( cfg ) * 0.25 )
		).toBeCloseTo( 0.725 );
	} );
} );

describe( 'isSimComplete', () => {
	it( 'is false before the duration has elapsed', () => {
		const cfg = config( { minutes: 10 } );
		expect( isSimComplete( cfg, simDurationMs( cfg ) - 1 ) ).toBe( false );
	} );

	it( 'is true exactly at the duration', () => {
		const cfg = config( { minutes: 10 } );
		expect( isSimComplete( cfg, simDurationMs( cfg ) ) ).toBe( true );
	} );

	it( 'is true past the duration', () => {
		const cfg = config( { minutes: 10 } );
		expect( isSimComplete( cfg, simDurationMs( cfg ) + 1000 ) ).toBe(
			true
		);
	} );
} );

describe( 'simRemainingMs', () => {
	it( 'is the full duration at elapsed 0', () => {
		const cfg = config( { minutes: 10 } );
		expect( simRemainingMs( cfg, 0 ) ).toBe( simDurationMs( cfg ) );
	} );

	it( 'is exactly half the duration at the midpoint', () => {
		const cfg = config( { minutes: 10 } );
		expect( simRemainingMs( cfg, simDurationMs( cfg ) / 2 ) ).toBe(
			simDurationMs( cfg ) / 2
		);
	} );

	it( 'is 0 exactly at the duration', () => {
		const cfg = config( { minutes: 10 } );
		expect( simRemainingMs( cfg, simDurationMs( cfg ) ) ).toBe( 0 );
	} );

	it( 'clamps to 0 past the duration — never goes negative', () => {
		const cfg = config( { minutes: 10 } );
		expect( simRemainingMs( cfg, simDurationMs( cfg ) * 2 ) ).toBe( 0 );
	} );

	it( 'is exactly 0 at the duration bound, not negative', () => {
		const cfg = config( { minutes: 5 } );
		const remaining = simRemainingMs( cfg, simDurationMs( cfg ) );
		expect( remaining ).toBe( 0 );
		expect( Object.is( remaining, -0 ) ).toBe( false );
	} );
} );
