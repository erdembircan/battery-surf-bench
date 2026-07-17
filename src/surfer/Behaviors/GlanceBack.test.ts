import { describe, it, expect, vi } from 'vitest';
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

	it( 'announces the scroll-up leg plus the speed-scaled settle, before either await', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new GlanceBack().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ] ),
			announce
		);

		const [ , scrollMs ] = motor.commands[ 0 ].args;
		const [ settleMs ] = motor.commands[ 1 ].args;
		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( scrollMs + settleMs );
	} );

	it( 'announces the scroll-up leg plus the speed-scaled settle at a non-1 speed', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new GlanceBack().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { speed: 10 } ),
			announce
		);

		const [ , scrollMs ] = motor.commands[ 0 ].args;
		const [ settleMs ] = motor.commands[ 1 ].args;
		// The scroll leg is never speed-scaled (a fixed 300ms); only the settle is.
		expect( scrollMs ).toBe( 300 );
		expect( announce ).toHaveBeenCalledWith( scrollMs + settleMs );
	} );

	it( 'keeps the same scroll px and settle ms as before the reorder — rng draw order is unaffected', async () => {
		// Regression: sampling both the scroll px and the settle ms before
		// either await (so `announce` can fire with the total up front) must
		// not perturb the shared rng sequence, since the scroll await consumes
		// no rng of its own. Pinned against the original (pre-reorder) rng
		// draw order: px first, then settleMs.
		const draws = [ 0.2, 0.8 ];
		const rng = () => draws.shift() ?? 0.5;
		const motor = new FakeMotor();

		await new GlanceBack().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { rng } )
		);

		const [ px ] = motor.commands[ 0 ].args;
		const [ settleMs ] = motor.commands[ 1 ].args;
		// px = 500 + 0.2 * (700 - 500) = 540 (scrollBy receives -px)
		expect( px ).toBeCloseTo( -540, 5 );
		// settleMs = 1000 + 0.8 * (3000 - 1000) = 2600
		expect( settleMs ).toBeCloseTo( 2600, 5 );
	} );
} );
