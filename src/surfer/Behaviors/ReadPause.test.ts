import { describe, it, expect, vi } from 'vitest';
import { ReadPause } from './ReadPause';
import { makeContext, openAffordances } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';
import { DRIVE_FLOOR } from '../Bid';
import { MAX } from '../../shared/SurferStats';

describe( 'ReadPause.bid', () => {
	it( 'still bids a small, nonzero floor at literacy 0', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new ReadPause().bid( ctx, 1 ) ).toBeCloseTo( DRIVE_FLOOR, 5 );
	} );

	it( 'bids full drive at literacy MAX with open affordance', () => {
		const ctx = makeContext( [ 0, 0, MAX, 0, 0 ] );
		expect( new ReadPause().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'zeroes exactly when there is no text', () => {
		const ctx = makeContext( [ 0, 0, MAX, 0, 0 ], {
			affordances: { ...openAffordances, textDensity: 0 },
		} );
		expect( new ReadPause().bid( ctx, 1 ) ).toBe( 0 );
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, MAX, 0, 0 ] );
		expect( new ReadPause().bid( ctx, 0.4 ) ).toBeCloseTo(
			new ReadPause().bid( ctx, 1 ) * 0.4,
			5
		);
	} );
} );

describe( 'ReadPause.run', () => {
	it( 'idles within the knowledge-base pause range', async () => {
		const motor = new FakeMotor();
		await new ReadPause().run( motor, makeContext( [ 0, 0, 5, 0, 0 ] ) );
		expect( motor.commands ).toHaveLength( 1 );
		expect( motor.commands[ 0 ].kind ).toBe( 'idle' );
		const [ ms ] = motor.commands[ 0 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 8000 );
		expect( ms ).toBeLessThanOrEqual( 20000 );
	} );

	it( 'divides the pause by the demo speed multiplier', async () => {
		const motor = new FakeMotor();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { speed: 10 } )
		);
		const [ ms ] = motor.commands[ 0 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 800 );
		expect( ms ).toBeLessThanOrEqual( 2000 );
	} );

	it( 'traces the cursor over the prose when the rng draws below the trace chance', async () => {
		const motor = new FakeMotor();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { rng: () => 0.1 } )
		);

		expect( motor.commands ).toHaveLength( 1 );
		expect( motor.commands[ 0 ].kind ).toBe( 'readTrace' );
		const [ ms ] = motor.commands[ 0 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 8000 );
		expect( ms ).toBeLessThanOrEqual( 20000 );
	} );

	it( 'holds still, exactly as before, when the rng draws above the trace chance', async () => {
		const motor = new FakeMotor();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { rng: () => 0.9 } )
		);

		expect( motor.commands ).toHaveLength( 1 );
		expect( motor.commands[ 0 ].kind ).toBe( 'idle' );
	} );

	it( 'divides a traced read by the demo speed multiplier too', async () => {
		const motor = new FakeMotor();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { rng: () => 0.1, speed: 10 } )
		);

		expect( motor.commands[ 0 ].kind ).toBe( 'readTrace' );
		const [ ms ] = motor.commands[ 0 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 800 );
		expect( ms ).toBeLessThanOrEqual( 2000 );
	} );

	it( 'announces the same wall-clock ms it eventually idles for', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { rng: () => 0.9 } ),
			announce
		);

		const [ idleMs ] = motor.commands[ 0 ].args;
		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( idleMs );
	} );

	it( 'announces the same wall-clock ms it eventually traces for', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { rng: () => 0.1 } ),
			announce
		);

		const [ traceMs ] = motor.commands[ 0 ].args;
		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( traceMs );
	} );

	it( 'announces the speed-scaled duration, not the raw sample', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { rng: () => 0.9, speed: 10 } ),
			announce
		);

		const [ idleMs ] = motor.commands[ 0 ].args;
		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( idleMs );
		expect( idleMs ).toBeLessThanOrEqual( 2000 );
	} );
} );
