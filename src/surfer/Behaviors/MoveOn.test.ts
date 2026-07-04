import { describe, it, expect } from 'vitest';
import { MoveOn } from './MoveOn';
import { makeContext } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';

describe( 'MoveOn.bid', () => {
	it( 'bids exactly the accumulated boredom', () => {
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
} );

describe( 'MoveOn.run', () => {
	it( 'performs no motion', async () => {
		const motor = new FakeMotor();
		await new MoveOn().run();
		expect( motor.commands ).toHaveLength( 0 );
	} );
} );
