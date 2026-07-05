/**
 * Tests for the pure battery-override resolver.
 */

import { describe, it, expect } from 'vitest';
import { resolveReading, type BatteryOverrideState } from './BatteryOverride';

const raw = { level: 0.62, charging: false };

const override = (
	partial: Partial< BatteryOverrideState > = {}
): BatteryOverrideState => ( {
	charging: null,
	level: null,
	...partial,
} );

describe( 'resolveReading', () => {
	it( 'passes the raw reading through when there is no override', () => {
		expect( resolveReading( raw ) ).toEqual( raw );
	} );

	it( 'passes the raw reading through when neither field is set', () => {
		expect( resolveReading( raw, override() ) ).toEqual( raw );
	} );

	it( 'substitutes only the charging state when only it is set', () => {
		expect( resolveReading( raw, override( { charging: true } ) ) ).toEqual(
			{ level: 0.62, charging: true }
		);
	} );

	it( 'substitutes only the level when only it is set', () => {
		expect( resolveReading( raw, override( { level: 0.1 } ) ) ).toEqual( {
			level: 0.1,
			charging: false,
		} );
	} );

	it( 'substitutes both fields when both are set', () => {
		expect(
			resolveReading( raw, override( { charging: true, level: 0.9 } ) )
		).toEqual( { level: 0.9, charging: true } );
	} );

	it( 'returns null when there is no raw reading and the override is incomplete', () => {
		expect(
			resolveReading( null, override( { charging: true } ) )
		).toBeNull();
		expect( resolveReading( null, override() ) ).toBeNull();
	} );

	it( 'synthesizes a full reading when there is no raw reading but both override fields are set', () => {
		expect(
			resolveReading( null, override( { charging: true, level: 0.4 } ) )
		).toEqual( { level: 0.4, charging: true } );
	} );

	it( 'returns null when there is no raw reading and no override', () => {
		expect( resolveReading( null ) ).toBeNull();
	} );
} );
