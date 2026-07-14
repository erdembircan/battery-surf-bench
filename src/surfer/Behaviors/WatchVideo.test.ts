import { describe, it, expect } from 'vitest';
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

/**
 * Sums every recorded `idle` command's duration.
 * @param motor
 */
const totalIdleMs = ( motor: FakeMotor ): number =>
	motor.commands
		.filter( ( c ) => 'idle' === c.kind )
		.reduce( ( sum, c ) => sum + c.args[ 0 ], 0 );

describe( 'WatchVideo.run', () => {
	it( 'starts playback, dwells the knowledge-base range in slices, then fully stops — no replay when the video never ends', async () => {
		const motor = new FakeMotor();
		// Default videoStateFallback is 'unavailable' (no readable state) —
		// the loop must never mistake that for 'ended'.
		await new WatchVideo().run( motor, makeContext( [ 0, 0, 0, 5, 0 ] ) );

		const kinds = motor.commands.map( ( c ) => c.kind );
		expect( kinds[ 0 ] ).toBe( 'playVideo' );
		expect( kinds[ kinds.length - 1 ] ).toBe( 'stopVideo' );
		expect( kinds.filter( ( k ) => 'replayVideo' === k ) ).toHaveLength(
			0
		);
		expect( kinds.filter( ( k ) => 'idle' === k ).length ).toBeGreaterThan(
			1
		);

		expect( totalIdleMs( motor ) ).toBeGreaterThanOrEqual( 30000 );
		expect( totalIdleMs( motor ) ).toBeLessThanOrEqual( 45000 );
	} );

	it( 'never replays a video that is genuinely still playing throughout the window', async () => {
		const motor = new FakeMotor();
		motor.videoStateFallback = 'playing';

		await new WatchVideo().run( motor, makeContext( [ 0, 0, 0, 5, 0 ] ) );

		expect(
			motor.commands.filter( ( c ) => 'replayVideo' === c.kind )
		).toHaveLength( 0 );
		expect( motor.commands[ motor.commands.length - 1 ].kind ).toBe(
			'stopVideo'
		);
	} );

	it( 'replays when the player reports the video ended mid-window (video shorter than the watch window)', async () => {
		const motor = new FakeMotor();
		motor.videoStateFallback = 'playing';
		// makeContext's neutral rng (0.5) + speed 1 yields a 37500ms window,
		// checked every 750ms — 49 state checks happen before the window
		// closes. Script the 3rd check to report 'ended'; every other check
		// reports 'playing', so exactly one replay should fire.
		motor.videoStateSequence = new Array( 49 ).fill( 'playing' );
		motor.videoStateSequence[ 2 ] = 'ended';

		await new WatchVideo().run( motor, makeContext( [ 0, 0, 0, 5, 0 ] ) );

		const replayIndices = motor.commands
			.map( ( c, i ) => ( 'replayVideo' === c.kind ? i : -1 ) )
			.filter( ( i ) => i >= 0 );
		expect( replayIndices ).toHaveLength( 1 );

		// The replay immediately follows the 3rd idle slice (index: playVideo,
		// idle, idle, idle, replayVideo -> index 4).
		expect( motor.commands[ replayIndices[ 0 ] - 1 ].kind ).toBe( 'idle' );

		// Replaying doesn't shrink the total dwell budget.
		expect( totalIdleMs( motor ) ).toBeGreaterThanOrEqual( 30000 );
		expect( totalIdleMs( motor ) ).toBeLessThanOrEqual( 45000 );
		expect( motor.commands[ motor.commands.length - 1 ].kind ).toBe(
			'stopVideo'
		);
	} );

	it( 'idles the full window and safely no-ops the stop when there is no controllable video at all', async () => {
		const motor = new FakeMotor();
		// videoStateFallback defaults to 'unavailable' — never 'ended'.
		await new WatchVideo().run( motor, makeContext( [ 0, 0, 0, 5, 0 ] ) );

		expect(
			motor.commands.filter( ( c ) => 'replayVideo' === c.kind )
		).toHaveLength( 0 );
		expect( totalIdleMs( motor ) ).toBeGreaterThanOrEqual( 30000 );
		expect( totalIdleMs( motor ) ).toBeLessThanOrEqual( 45000 );
	} );
} );
