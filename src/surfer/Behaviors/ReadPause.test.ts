import { describe, it, expect, vi } from 'vitest';
import { ReadPause } from '@/surfer/Behaviors/ReadPause';
import { makeContext, openAffordances } from '@/surfer/TestFixtures';
import { FakeMotor } from '@/surfer/FakeMotor';
import { DRIVE_FLOOR } from '@/surfer/Bid';
import { MAX } from '@/shared/SurferStats';

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
	it( 'issues exactly one read command within the knowledge-base pause range', async () => {
		const motor = new FakeMotor();
		await new ReadPause().run( motor, makeContext( [ 0, 0, 5, 0, 0 ] ) );
		expect( motor.commands ).toHaveLength( 1 );
		expect( motor.commands[ 0 ].kind ).toBe( 'read' );
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
		expect( motor.commands[ 0 ].kind ).toBe( 'read' );
		const [ ms ] = motor.commands[ 0 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 800 );
		expect( ms ).toBeLessThanOrEqual( 2000 );
	} );

	it( 'announces the same wall-clock ms the read command receives', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ] ),
			announce
		);

		const [ readMs ] = motor.commands[ 0 ].args;
		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( readMs );
	} );

	it( 'announces the speed-scaled duration, not the raw sample', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new ReadPause().run(
			motor,
			makeContext( [ 0, 0, 5, 0, 0 ], { speed: 10 } ),
			announce
		);

		const [ readMs ] = motor.commands[ 0 ].args;
		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( readMs );
		expect( readMs ).toBeLessThanOrEqual( 2000 );
	} );
} );
