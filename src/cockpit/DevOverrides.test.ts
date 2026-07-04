/**
 * Tests for the dev-tools battery-reading override. The consumer is
 * `BatteryStore`'s `onReading` funnel, which passes every raw reading through
 * {@link applyDevOverrides} before anything else sees it; these tests assert
 * that seam's contract directly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { devOverrides, applyDevOverrides, onDevReading } from './DevOverrides';
import { type BatteryReading } from './BatteryMonitor';

describe( 'DevOverrides', () => {
	beforeEach( () => {
		devOverrides.bypassCharging = false;
		devOverrides.actualCharging = null;
	} );

	it( 'returns the raw reading unchanged when the bypass is off', () => {
		const raw: BatteryReading = { level: 0.5, charging: true };

		const result = applyDevOverrides( raw );

		expect( result ).toEqual( { level: 0.5, charging: true } );
		expect( devOverrides.actualCharging ).toBeNull();
	} );

	it( 'never mutates the raw reading', () => {
		const raw: BatteryReading = { level: 0.5, charging: true };
		devOverrides.bypassCharging = true;

		applyDevOverrides( raw );

		expect( raw ).toEqual( { level: 0.5, charging: true } );
	} );

	it( 'forces charging false and records the raw truth while bypassing', () => {
		devOverrides.bypassCharging = true;

		const result = applyDevOverrides( { level: 0.9, charging: true } );

		expect( result ).toEqual( { level: 0.9, charging: false } );
		expect( devOverrides.actualCharging ).toBe( true );
	} );

	it( 'records a discharging raw truth the same way', () => {
		devOverrides.bypassCharging = true;

		applyDevOverrides( { level: 0.9, charging: false } );

		expect( devOverrides.actualCharging ).toBe( false );
	} );

	it( 'notifies subscribers only while bypassing', () => {
		let calls = 0;
		onDevReading( () => {
			calls += 1;
		} );

		applyDevOverrides( { level: 0.9, charging: true } );
		expect( calls ).toBe( 0 );

		devOverrides.bypassCharging = true;
		applyDevOverrides( { level: 0.9, charging: true } );
		expect( calls ).toBe( 1 );
	} );

	it( 'stops notifying an unsubscribed listener', () => {
		let calls = 0;
		const unsubscribe = onDevReading( () => {
			calls += 1;
		} );

		devOverrides.bypassCharging = true;
		applyDevOverrides( { level: 0.9, charging: true } );
		expect( calls ).toBe( 1 );

		unsubscribe();
		applyDevOverrides( { level: 0.8, charging: true } );
		expect( calls ).toBe( 1 );
	} );
} );
