import { describe, it, expect, vi } from 'vitest';
import {
	SelectSnippet,
	SELECT_SNIPPET_DISPLAY_MS,
} from '@/surfer/Behaviors/SelectSnippet';
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

	it( 'announces the fixed selection-choreography duration before selecting', async () => {
		const motor = new FakeMotor();
		const announce = vi.fn();
		await new SelectSnippet().run(
			motor,
			makeContext( [ 0, 0, 0, 0, MAX ] ),
			announce
		);

		expect( announce ).toHaveBeenCalledTimes( 1 );
		expect( announce ).toHaveBeenCalledWith( SELECT_SNIPPET_DISPLAY_MS );
	} );
} );
