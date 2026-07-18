import { describe, it, expect } from 'vitest';
import { MicroScroll } from '@/surfer/Behaviors/MicroScroll';
import { makeContext } from '@/surfer/TestFixtures';
import { FakeMotor } from '@/surfer/FakeMotor';
import { DRIVE_FLOOR } from '@/surfer/Bid';
import { MAX } from '@/shared/SurferStats';

describe( 'MicroScroll.bid', () => {
	it( 'still bids a small, nonzero floor at fidget 0', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new MicroScroll().bid( ctx, 1 ) ).toBeCloseTo( DRIVE_FLOOR, 5 );
	} );

	it( 'bids full drive at fidget MAX', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, MAX ] );
		expect( new MicroScroll().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'is unaffected by page affordances', () => {
		const withNothing = makeContext( [ 0, 0, 0, 0, MAX ], {
			affordances: {
				scrollRemaining: 0,
				textDensity: 0,
				hasVideo: false,
				imageCount: 0,
			},
		} );
		expect( new MicroScroll().bid( withNothing, 1 ) ).toBeCloseTo(
			new MicroScroll().bid( makeContext( [ 0, 0, 0, 0, MAX ] ), 1 ),
			5
		);
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, MAX ] );
		expect( new MicroScroll().bid( ctx, 0.9 ) ).toBeCloseTo(
			new MicroScroll().bid( ctx, 1 ) * 0.9,
			5
		);
	} );
} );

describe( 'MicroScroll.run', () => {
	it( 'jitters within the micro-scroll pixel range, either direction', async () => {
		const motor = new FakeMotor();
		let call = 0;
		const rng = () => [ 0.5, 0.1 ][ call++ ]; // magnitude=60px, direction=up
		await new MicroScroll().run(
			motor,
			makeContext( [ 0, 0, 0, 0, 5 ], { rng } )
		);
		expect( motor.commands[ 0 ].kind ).toBe( 'scrollBy' );
		const [ px ] = motor.commands[ 0 ].args;
		expect( Math.abs( px ) ).toBeGreaterThanOrEqual( 40 );
		expect( Math.abs( px ) ).toBeLessThanOrEqual( 80 );
		expect( px ).toBeLessThan( 0 );
	} );
} );
