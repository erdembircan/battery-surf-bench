import { describe, it, expect } from 'vitest';
import { MoveOn, MIN_DWELL_MS, LEAVE_RAMP_MS } from './MoveOn';
import { makeContext } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';

describe( 'MoveOn.bid', () => {
	it( 'bids exactly the accumulated boredom once fully ramped', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new MoveOn().bid( ctx, 1, 0.37 ) ).toBe( 0.37 );
	} );

	it( 'never bids negative even if boredom underflows', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new MoveOn().bid( ctx, 1, -5 ) ).toBe( 0 );
	} );

	it( 'ignores traits and affordances entirely', () => {
		const highEndurance = makeContext( [ 0, 10, 0, 0, 0 ] );
		const noEndurance = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new MoveOn().bid( highEndurance, 1, 1 ) ).toBe(
			new MoveOn().bid( noEndurance, 1, 1 )
		);
	} );

	it( 'bids 0 below the dwell floor regardless of boredom', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ], {
			elapsedMs: MIN_DWELL_MS - 1,
		} );
		expect( new MoveOn().bid( ctx, 1, 1000 ) ).toBe( 0 );
	} );

	it( 'ramps proportionally between the dwell floor and full ramp', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ], {
			elapsedMs: MIN_DWELL_MS + LEAVE_RAMP_MS / 2,
		} );
		expect( new MoveOn().bid( ctx, 1, 1 ) ).toBeCloseTo( 0.5 );
	} );

	it( 'bids the full boredom at and beyond the end of the ramp', () => {
		const atRampEnd = makeContext( [ 0, 0, 0, 0, 0 ], {
			elapsedMs: MIN_DWELL_MS + LEAVE_RAMP_MS,
		} );
		const wellPastRamp = makeContext( [ 0, 0, 0, 0, 0 ], {
			elapsedMs: MIN_DWELL_MS + LEAVE_RAMP_MS * 10,
		} );
		expect( new MoveOn().bid( atRampEnd, 1, 0.6 ) ).toBeCloseTo( 0.6 );
		expect( new MoveOn().bid( wellPastRamp, 1, 0.6 ) ).toBeCloseTo( 0.6 );
	} );
} );

describe( 'MoveOn.run', () => {
	it( 'performs no motion', async () => {
		const motor = new FakeMotor();
		await new MoveOn().run();
		expect( motor.commands ).toHaveLength( 0 );
	} );
} );
