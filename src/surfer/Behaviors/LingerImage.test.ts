import { describe, it, expect } from 'vitest';
import { LingerImage } from './LingerImage';
import { makeContext, openAffordances } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';
import { DRIVE_FLOOR } from '../Bid';
import { MAX } from '../../shared/SurferStats';

describe( 'LingerImage.bid', () => {
	it( 'still bids a small, nonzero floor at allure 0', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new LingerImage().bid( ctx, 1 ) ).toBeCloseTo( DRIVE_FLOOR, 5 );
	} );

	it( 'bids full drive at allure MAX with images saturating the affordance', () => {
		const ctx = makeContext( [ 0, 0, 0, MAX, 0 ], {
			affordances: { ...openAffordances, imageCount: 4 },
		} );
		expect( new LingerImage().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'zeroes exactly when the page has no images', () => {
		const ctx = makeContext( [ 0, 0, 0, MAX, 0 ], {
			affordances: { ...openAffordances, imageCount: 0 },
		} );
		expect( new LingerImage().bid( ctx, 1 ) ).toBe( 0 );
	} );

	it( 'saturates rather than exceeding full affordance past the threshold', () => {
		const ctx = makeContext( [ 0, 0, 0, MAX, 0 ], {
			affordances: { ...openAffordances, imageCount: 40 },
		} );
		expect( new LingerImage().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, 0, MAX, 0 ] );
		expect( new LingerImage().bid( ctx, 0.6 ) ).toBeCloseTo(
			new LingerImage().bid( ctx, 1 ) * 0.6,
			5
		);
	} );
} );

describe( 'LingerImage.run', () => {
	it( 'drifts the pointer within the knowledge-base linger range', async () => {
		const motor = new FakeMotor();
		await new LingerImage().run( motor, makeContext( [ 0, 0, 0, 5, 0 ] ) );
		expect( motor.commands[ 0 ].kind ).toBe( 'pointerDrift' );
		const [ ms ] = motor.commands[ 0 ].args;
		expect( ms ).toBeGreaterThanOrEqual( 1500 );
		expect( ms ).toBeLessThanOrEqual( 4000 );
	} );
} );
