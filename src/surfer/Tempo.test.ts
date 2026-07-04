import { describe, it, expect } from 'vitest';
import { tickIntervalMs, flickPx, flickEaseMs } from './Tempo';
import { MAX } from '../shared/SurferStats';

describe( 'tickIntervalMs', () => {
	it( 'is slowest at tempo 0 and fastest at tempo MAX', () => {
		expect( tickIntervalMs( 0 ) ).toBe( 1400 );
		expect( tickIntervalMs( MAX ) ).toBe( 350 );
		expect( tickIntervalMs( MAX ) ).toBeLessThan( tickIntervalMs( 0 ) );
	} );
} );

describe( 'flickPx', () => {
	it( 'is smallest at tempo 0 and largest at tempo MAX', () => {
		expect( flickPx( 0 ) ).toBe( 350 );
		expect( flickPx( MAX ) ).toBe( 800 );
	} );
} );

describe( 'flickEaseMs', () => {
	it( 'eases slowest at tempo 0 and quickest at tempo MAX', () => {
		expect( flickEaseMs( 0 ) ).toBe( 400 );
		expect( flickEaseMs( MAX ) ).toBe( 150 );
	} );
} );
