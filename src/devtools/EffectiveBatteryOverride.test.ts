/**
 * Tests for the battery-override resolver: the pure function that combines
 * the manual override layer and the discharge-simulation layer into the one
 * effective override the rest of the cockpit acts on.
 */

import { describe, it, expect } from 'vitest';
import { effectiveBatteryOverride } from '@/devtools/EffectiveBatteryOverride';

describe( 'effectiveBatteryOverride', () => {
	it( 'forces discharging at the sim’s current level while the sim is running', () => {
		const result = effectiveBatteryOverride( {
			battery: { charging: null, level: null },
			sim: { running: true, currentLevel: 0.42 },
		} );

		expect( result ).toEqual( { charging: false, level: 0.42 } );
	} );

	it( 'wins over the manual layer outright while the sim is running', () => {
		const result = effectiveBatteryOverride( {
			battery: { charging: true, level: 0.9 },
			sim: { running: true, currentLevel: 0.15 },
		} );

		expect( result ).toEqual( { charging: false, level: 0.15 } );
	} );

	it( 'passes the manual layer through unchanged while not running', () => {
		const result = effectiveBatteryOverride( {
			battery: { charging: true, level: 0.6 },
			sim: { running: false, currentLevel: null },
		} );

		expect( result ).toEqual( { charging: true, level: 0.6 } );
	} );

	it( 'passes through a follow-system manual layer ({null, null}) while not running', () => {
		const result = effectiveBatteryOverride( {
			battery: { charging: null, level: null },
			sim: { running: false, currentLevel: null },
		} );

		expect( result ).toEqual( { charging: null, level: null } );
	} );

	it( 'treats a missing sim slice as not running — the manual layer passes through', () => {
		const result = effectiveBatteryOverride( {
			battery: { charging: false, level: 0.3 },
		} );

		expect( result ).toEqual( { charging: false, level: 0.3 } );
	} );
} );
