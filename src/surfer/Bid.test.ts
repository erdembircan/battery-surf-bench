import { describe, it, expect } from 'vitest';
import {
	clamp01,
	lerp,
	drive,
	noise,
	DRIVE_FLOOR,
	NOISE_AMP,
} from '@/surfer/Bid';
import { MAX } from '@/shared/SurferStats';

describe( 'clamp01', () => {
	it( 'clamps below 0 and above 1', () => {
		expect( clamp01( -5 ) ).toBe( 0 );
		expect( clamp01( 5 ) ).toBe( 1 );
		expect( clamp01( 0.5 ) ).toBe( 0.5 );
	} );
} );

describe( 'lerp', () => {
	it( 'interpolates and clamps t', () => {
		expect( lerp( 0, 10, 0 ) ).toBe( 0 );
		expect( lerp( 0, 10, 1 ) ).toBe( 10 );
		expect( lerp( 0, 10, 0.5 ) ).toBe( 5 );
		expect( lerp( 0, 10, 2 ) ).toBe( 10 );
		expect( lerp( 0, 10, -1 ) ).toBe( 0 );
	} );
} );

describe( 'drive', () => {
	it( 'floors a zero stat rather than zeroing it', () => {
		expect( drive( 0 ) ).toBe( DRIVE_FLOOR );
	} );

	it( 'reaches full drive at MAX', () => {
		expect( drive( MAX ) ).toBe( 1 );
	} );

	it( 'is linear between the floor and 1', () => {
		expect( drive( MAX / 2 ) ).toBeCloseTo( ( DRIVE_FLOOR + 1 ) / 2, 5 );
	} );
} );

describe( 'noise', () => {
	it( 'is 1 at the neutral rng midpoint', () => {
		expect( noise( () => 0.5 ) ).toBe( 1 );
	} );

	it( 'swings within the noise band and never goes negative', () => {
		expect( noise( () => 0 ) ).toBeCloseTo( 1 - NOISE_AMP, 5 );
		expect( noise( () => 1 ) ).toBeCloseTo( 1 + NOISE_AMP, 5 );
	} );
} );
