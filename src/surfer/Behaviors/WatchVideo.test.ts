import { describe, it, expect, vi } from 'vitest';
import { WatchVideo } from './WatchVideo';
import { makeContext, openAffordances } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';
import { DRIVE_FLOOR } from '../Bid';
import { MAX } from '../../shared/SurferStats';

describe( 'WatchVideo.bid', () => {
	it( 'still bids a small, nonzero floor at allure 0', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new WatchVideo().bid( ctx, 1 ) ).toBeCloseTo( DRIVE_FLOOR, 5 );
	} );

	it( 'bids full drive at allure MAX with a video present', () => {
		const ctx = makeContext( [ 0, 0, 0, MAX, 0 ] );
		expect( new WatchVideo().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'zeroes exactly when the page has no video', () => {
		const ctx = makeContext( [ 0, 0, 0, MAX, 0 ], {
			affordances: { ...openAffordances, hasVideo: false },
		} );
		expect( new WatchVideo().bid( ctx, 1 ) ).toBe( 0 );
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, 0, MAX, 0 ] );
		expect( new WatchVideo().bid( ctx, 0.2 ) ).toBeCloseTo(
			new WatchVideo().bid( ctx, 1 ) * 0.2,
			5
		);
	} );
} );

describe( 'WatchVideo.run', () => {
	it( "is a plain start -> dwell -> stop sequence — any mid-window replay is the motor/control seam's job, not this behavior's", async () => {
		const motor = new FakeMotor();
		await new WatchVideo().run( motor, makeContext( [ 0, 0, 0, 5, 0 ] ) );

		expect( motor.commands.map( ( c ) => c.kind ) ).toEqual( [
			'playVideo',
			'idle',
			'stopVideo',
		] );
		const [ ms ] = motor.commands[ 1 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 30000 );
		expect( ms ).toBeLessThanOrEqual( 45000 );
	} );

	it( 'announces the same wall-clock ms it eventually watches for', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new WatchVideo().run(
			motor,
			makeContext( [ 0, 0, 0, 5, 0 ] ),
			announce
		);

		const [ watchMs ] = motor.commands[ 1 ].args;
		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( watchMs );
	} );

	it( 'announces the speed-scaled duration', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new WatchVideo().run(
			motor,
			makeContext( [ 0, 0, 0, 5, 0 ], { speed: 10 } ),
			announce
		);

		const [ watchMs ] = motor.commands[ 1 ].args;
		expect( announce ).toHaveBeenCalledWith( watchMs );
		expect( watchMs ).toBeLessThanOrEqual( 4500 );
	} );
} );
