import { describe, it, expect } from 'vitest';
import { buildBehaviorContext } from '@/surfer/PageSense';
import { openAffordances } from '@/surfer/TestFixtures';
import { FakeClock } from '@/surfer/FakeClock';

describe( 'buildBehaviorContext', () => {
	it( 'senses affordances fresh on every call', () => {
		let scrollRemaining = 1;
		const deps = {
			traits: [ 0, 0, 0, 0, 0 ],
			senseAffordances: () => ( { ...openAffordances, scrollRemaining } ),
			rng: () => 0.5,
			clock: new FakeClock(),
			speed: 1,
		};

		expect(
			buildBehaviorContext( deps, 0 ).affordances.scrollRemaining
		).toBe( 1 );

		scrollRemaining = 0;

		expect(
			buildBehaviorContext( deps, 0 ).affordances.scrollRemaining
		).toBe( 0 );
	} );

	it( 'derives elapsedMs as the real elapsed time since startedAt, scaled by speed', async () => {
		const clock = new FakeClock();
		const deps = {
			traits: [ 0, 0, 0, 0, 0 ],
			senseAffordances: () => openAffordances,
			rng: () => 0.5,
			clock,
			speed: 4,
		};

		const startedAt = clock.now();
		await clock.wait( 1000 );

		expect( buildBehaviorContext( deps, startedAt ).elapsedMs ).toBe(
			4000
		);
	} );

	it( 'carries the traits, rng, clock and speed through unchanged', () => {
		const rng = () => 0.42;
		const clock = new FakeClock();
		const traits = [ 1, 2, 3, 4, 5 ];
		const deps = {
			traits,
			senseAffordances: () => openAffordances,
			rng,
			clock,
			speed: 10,
		};

		const ctx = buildBehaviorContext( deps, 0 );

		expect( ctx.traits ).toBe( traits );
		expect( ctx.rng ).toBe( rng );
		expect( ctx.clock ).toBe( clock );
		expect( ctx.speed ).toBe( 10 );
	} );
} );
