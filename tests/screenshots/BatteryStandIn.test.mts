/**
 * Tests for the schedule the battery stand-in plays, and for the stand-in
 * itself as the cockpit sees it through `navigator.getBattery()`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	STAND_IN_START_LEVEL,
	STAND_IN_STEPS_MS,
	installBatteryStandIn,
	standInSchedule,
} from './BatteryStandIn.mts';

describe( 'standInSchedule', () => {
	it( 'places each step at the running sum of the step durations', () => {
		const schedule = standInSchedule( 0.87, [ 1000, 2000, 4000 ], 3 );

		expect( schedule.map( ( step ) => step.atMs ) ).toEqual( [
			1000, 3000, 7000,
		] );
	} );

	it( 'drops the level 1 % at a time, in exact two-decimal values', () => {
		const schedule = standInSchedule( 0.87, [ 1000 ], 4 );

		expect( schedule[ 0 ].level ).toBe( 0.86 );
		expect( schedule[ 1 ].level ).toBe( 0.85 );
		expect( schedule[ 2 ].level ).toBe( 0.84 );
		expect( schedule[ 3 ].level ).toBe( 0.83 );
	} );

	it( 'cycles the durations once past the end of the list', () => {
		const schedule = standInSchedule( 0.87, [ 1000, 3000 ], 5 );

		expect( schedule.map( ( step ) => step.atMs ) ).toEqual( [
			1000, 4000, 5000, 8000, 9000,
		] );
	} );

	it( 'averages 16 % an hour over the default steps', () => {
		const schedule = standInSchedule(
			STAND_IN_START_LEVEL,
			STAND_IN_STEPS_MS,
			STAND_IN_STEPS_MS.length
		);
		const elapsedHours = schedule[ schedule.length - 1 ].atMs / 3_600_000;

		expect( schedule.length / elapsedHours ).toBeCloseTo( 16, 1 );
	} );
} );

describe( 'installBatteryStandIn', () => {
	afterEach( () => {
		vi.useRealTimers();
		Reflect.deleteProperty( Navigator.prototype, 'getBattery' );
	} );

	it( 'serves an unplugged battery at the start level through getBattery()', async () => {
		installBatteryStandIn( { startLevel: 0.87, schedule: [] } );

		const battery = await (
			navigator as unknown as {
				getBattery: () => Promise< {
					level: number;
					charging: boolean;
				} >;
			}
		 ).getBattery();

		expect( battery.level ).toBe( 0.87 );
		expect( battery.charging ).toBe( false );
	} );

	it( 'lowers the level and fires levelchange at each scheduled step', async () => {
		vi.useFakeTimers();
		installBatteryStandIn( {
			startLevel: 0.87,
			schedule: [ { atMs: 5000, level: 0.86 } ],
		} );

		const battery = await (
			navigator as unknown as {
				getBattery: () => Promise< EventTarget & { level: number } >;
			}
		 ).getBattery();
		const onLevelChange = vi.fn();
		battery.addEventListener( 'levelchange', onLevelChange );

		vi.advanceTimersByTime( 4999 );
		expect( battery.level ).toBe( 0.87 );
		expect( onLevelChange ).not.toHaveBeenCalled();

		vi.advanceTimersByTime( 1 );
		expect( battery.level ).toBe( 0.86 );
		expect( onLevelChange ).toHaveBeenCalledTimes( 1 );
	} );
} );
