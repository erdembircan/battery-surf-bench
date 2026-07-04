import { describe, it, expect } from 'vitest';
import { ScrollBurst } from './ScrollBurst';
import { makeContext } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';

describe( 'ScrollBurst.bid', () => {
	it( 'bids the same baseline regardless of trait values', () => {
		const zeroTraits = makeContext( [ 0, 0, 0, 0, 0 ] );
		const maxTraits = makeContext( [ 10, 10, 10, 10, 10 ] );
		const bid = new ScrollBurst().bid( zeroTraits, 1 );
		expect( bid ).toBeGreaterThan( 0 );
		expect( new ScrollBurst().bid( maxTraits, 1 ) ).toBe( bid );
	} );

	it( 'goes quiet once no scrollable content remains', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ], {
			affordances: {
				scrollRemaining: 0,
				textDensity: 1,
				hasVideo: true,
				imageCount: 4,
			},
		} );
		expect( new ScrollBurst().bid( ctx, 1 ) ).toBe( 0 );
	} );

	it( 'scales linearly with remaining scroll', () => {
		const half = makeContext( [ 0, 0, 0, 0, 0 ], {
			affordances: {
				scrollRemaining: 0.5,
				textDensity: 1,
				hasVideo: true,
				imageCount: 4,
			},
		} );
		const full = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new ScrollBurst().bid( half, 1 ) ).toBeCloseTo(
			new ScrollBurst().bid( full, 1 ) / 2,
			5
		);
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new ScrollBurst().bid( ctx, 0.5 ) ).toBeCloseTo(
			new ScrollBurst().bid( ctx, 1 ) / 2,
			5
		);
	} );
} );

describe( 'ScrollBurst.run', () => {
	it( 'flicks a larger, quicker burst at higher tempo', async () => {
		const slow = new FakeMotor();
		const fast = new FakeMotor();
		await new ScrollBurst().run( slow, makeContext( [ 0, 0, 0, 0, 0 ] ) );
		await new ScrollBurst().run( fast, makeContext( [ 10, 0, 0, 0, 0 ] ) );

		const [ slowPx, slowMs ] = slow.commands[ 0 ].args;
		const [ fastPx, fastMs ] = fast.commands[ 0 ].args;

		expect( fastPx ).toBeGreaterThan( slowPx );
		expect( fastMs ).toBeLessThan( slowMs );
	} );
} );
