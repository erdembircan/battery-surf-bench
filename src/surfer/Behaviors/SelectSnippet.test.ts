import { describe, it, expect, vi } from 'vitest';
import { SelectSnippet } from '@/surfer/Behaviors/SelectSnippet';
import { makeContext, openAffordances } from '@/surfer/TestFixtures';
import { FakeMotor } from '@/surfer/FakeMotor';
import { DRIVE_FLOOR } from '@/surfer/Bid';
import { MAX } from '@/shared/SurferStats';

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
		await new SelectSnippet().run(
			motor,
			makeContext( [ 0, 0, 0, 0, MAX ] )
		);
		expect( motor.commands ).toEqual( [
			{ kind: 'selectSnippet', args: [] },
		] );
	} );

	it( 'announces the duration the motor plans for the snippet it picks', async () => {
		const motor = new FakeMotor( 2345 );
		const announce = vi.fn();
		await new SelectSnippet().run(
			motor,
			makeContext( [ 0, 0, 0, 0, MAX ] ),
			announce
		);

		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( 2345 );
	} );

	it( 'announces nothing when the motor finds nothing to select', async () => {
		const motor = new FakeMotor( null );
		const announce = vi.fn();
		await new SelectSnippet().run(
			motor,
			makeContext( [ 0, 0, 0, 0, MAX ] ),
			announce
		);

		expect( announce ).not.toHaveBeenCalled();
		expect( motor.commands ).toEqual( [
			{ kind: 'selectSnippet', args: [] },
		] );
	} );
} );
