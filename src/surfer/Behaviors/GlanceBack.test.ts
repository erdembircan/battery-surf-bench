import { describe, it, expect } from 'vitest';
import { GlanceBack } from './GlanceBack';
import { makeContext, openAffordances } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';
import { DRIVE_FLOOR } from '../Bid';
import { MAX } from '../../shared/SurferStats';

describe( 'GlanceBack.bid', () => {
	it( 'still bids a small, nonzero floor at literacy 0', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ], {
			affordances: { ...openAffordances, scrollRemaining: 0 },
		} );
		expect( new GlanceBack().bid( ctx, 1 ) ).toBeCloseTo( DRIVE_FLOOR, 5 );
	} );

	it( 'bids full drive at literacy MAX once fully scrolled', () => {
		const ctx = makeContext( [ 0, 0, MAX, 0, 0 ], {
			affordances: { ...openAffordances, scrollRemaining: 0 },
		} );
		expect( new GlanceBack().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'zeroes exactly before any scrolling has happened', () => {
		const ctx = makeContext( [ 0, 0, MAX, 0, 0 ], {
			affordances: { ...openAffordances, scrollRemaining: 1 },
		} );
		expect( new GlanceBack().bid( ctx, 1 ) ).toBe( 0 );
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, MAX, 0, 0 ], {
			affordances: { ...openAffordances, scrollRemaining: 0 },
		} );
		expect( new GlanceBack().bid( ctx, 0.3 ) ).toBeCloseTo(
			new GlanceBack().bid( ctx, 1 ) * 0.3,
			5
		);
	} );
} );

describe( 'GlanceBack.run', () => {
	it( 'scrolls up then settles', async () => {
		const motor = new FakeMotor();
		await new GlanceBack().run( motor, makeContext( [ 0, 0, 5, 0, 0 ] ) );

		expect( motor.commands ).toHaveLength( 2 );
		expect( motor.commands[ 0 ].kind ).toBe( 'scrollBy' );
		expect( motor.commands[ 0 ].args[ 0 ] ).toBeLessThan( 0 ); // scrolls up
		expect( motor.commands[ 1 ].kind ).toBe( 'idle' );
	} );
} );
