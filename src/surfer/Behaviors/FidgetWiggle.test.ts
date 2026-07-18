import { describe, it, expect } from 'vitest';
import { FidgetWiggle } from '@/surfer/Behaviors/FidgetWiggle';
import { makeContext, openAffordances } from '@/surfer/TestFixtures';
import { FakeMotor } from '@/surfer/FakeMotor';
import { DRIVE_FLOOR } from '@/surfer/Bid';
import { MAX } from '@/shared/SurferStats';

describe( 'FidgetWiggle.bid', () => {
	it( 'still bids a small, nonzero floor at fidget 0', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new FidgetWiggle().bid( ctx, 1 ) ).toBeCloseTo(
			DRIVE_FLOOR,
			5
		);
	} );

	it( 'bids full drive at fidget MAX', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, MAX ] );
		expect( new FidgetWiggle().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'is unaffected by page affordances — needs no page support', () => {
		const withNothing = makeContext( [ 0, 0, 0, 0, MAX ], {
			affordances: {
				scrollRemaining: 0,
				textDensity: 0,
				hasVideo: false,
				imageCount: 0,
			},
		} );
		const withEverything = makeContext( [ 0, 0, 0, 0, MAX ], {
			affordances: openAffordances,
		} );
		expect( new FidgetWiggle().bid( withNothing, 1 ) ).toBeCloseTo(
			new FidgetWiggle().bid( withEverything, 1 ),
			5
		);
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, MAX ] );
		expect( new FidgetWiggle().bid( ctx, 0.7 ) ).toBeCloseTo(
			new FidgetWiggle().bid( ctx, 1 ) * 0.7,
			5
		);
	} );
} );

describe( 'FidgetWiggle.run', () => {
	it( 'drifts the pointer briefly', async () => {
		const motor = new FakeMotor();
		await new FidgetWiggle().run( motor, makeContext( [ 0, 0, 0, 0, 5 ] ) );
		expect( motor.commands[ 0 ].kind ).toBe( 'pointerDrift' );
		const [ ms ] = motor.commands[ 0 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 500 );
		expect( ms ).toBeLessThanOrEqual( 1500 );
	} );
} );
