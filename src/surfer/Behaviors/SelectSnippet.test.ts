import { describe, it, expect } from 'vitest';
import { SelectSnippet } from './SelectSnippet';
import { makeContext, openAffordances } from '../TestFixtures';
import { FakeMotor } from '../FakeMotor';
import { DRIVE_FLOOR } from '../Bid';
import { MAX } from '../../shared/SurferStats';

describe( 'SelectSnippet.bid', () => {
	it( 'still bids a small, nonzero floor at fidget 0', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, 0 ] );
		expect( new SelectSnippet().bid( ctx, 1 ) ).toBeCloseTo(
			DRIVE_FLOOR,
			5
		);
	} );

	it( 'bids full drive at fidget MAX with text present', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, MAX ] );
		expect( new SelectSnippet().bid( ctx, 1 ) ).toBeCloseTo( 1, 5 );
	} );

	it( 'zeroes exactly when there is no text to select', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, MAX ], {
			affordances: { ...openAffordances, textDensity: 0 },
		} );
		expect( new SelectSnippet().bid( ctx, 1 ) ).toBe( 0 );
	} );

	it( 'scales linearly with appetite', () => {
		const ctx = makeContext( [ 0, 0, 0, 0, MAX ] );
		expect( new SelectSnippet().bid( ctx, 0.15 ) ).toBeCloseTo(
			new SelectSnippet().bid( ctx, 1 ) * 0.15,
			5
		);
	} );
} );

describe( 'SelectSnippet.run', () => {
	it( 'selects a snippet through the motor', async () => {
		const motor = new FakeMotor();
		await new SelectSnippet().run( motor );
		expect( motor.commands ).toEqual( [
			{ kind: 'selectSnippet', args: [] },
		] );
	} );
} );
