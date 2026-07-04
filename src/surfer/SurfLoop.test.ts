import { describe, it, expect, vi } from 'vitest';
import { SurfLoop } from './SurfLoop';
import { FakeMotor } from './FakeMotor';
import { FakeClock } from './FakeClock';
import { ScrollBurst } from './Behaviors/ScrollBurst';
import { MoveOn } from './Behaviors/MoveOn';
import { openAffordances } from './TestFixtures';

const neutralRng = () => 0.5;

describe( 'SurfLoop', () => {
	it( 'runs a content behavior before MoveOn ends the page', async () => {
		const motor = new FakeMotor();
		const onPageDone = vi.fn();
		const loop = new SurfLoop( {
			behaviors: [ new ScrollBurst(), new MoveOn() ],
			motor,
			clock: new FakeClock(),
			rng: () => 0.999999, // always resolves to the last positive-bid entry
			traits: [ 0, 0, 0, 0, 0 ],
			affordances: openAffordances,
			speed: 1,
			onPageDone,
		} );

		loop.start();
		await vi.waitFor( () =>
			expect( onPageDone ).toHaveBeenCalledTimes( 1 )
		);

		expect( motor.commands.some( ( c ) => c.kind === 'scrollBy' ) ).toBe(
			true
		);
	} );

	it( 'calls onPageDone exactly once and performs no motion for a MoveOn-only page', async () => {
		const motor = new FakeMotor();
		const onPageDone = vi.fn();
		const loop = new SurfLoop( {
			behaviors: [ new MoveOn() ],
			motor,
			clock: new FakeClock(),
			rng: neutralRng,
			traits: [ 0, 0, 0, 0, 0 ],
			affordances: openAffordances,
			speed: 1,
			onPageDone,
		} );

		loop.start();
		await vi.waitFor( () =>
			expect( onPageDone ).toHaveBeenCalledTimes( 1 )
		);

		// Give any (incorrect) further ticks a chance to run before asserting.
		await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

		expect( onPageDone ).toHaveBeenCalledTimes( 1 );
		expect( motor.commands ).toHaveLength( 0 );
	} );

	it( 'camps longer at high endurance than at low endurance', async () => {
		const runUntilDone = async ( endurance: number ) => {
			const clock = new FakeClock();
			const onPageDone = vi.fn();
			const loop = new SurfLoop( {
				behaviors: [ new ScrollBurst(), new MoveOn() ],
				motor: new FakeMotor(),
				clock,
				rng: neutralRng,
				traits: [ 0, endurance, 0, 0, 0 ],
				affordances: openAffordances,
				speed: 1,
				onPageDone,
			} );

			loop.start();
			await vi.waitFor( () =>
				expect( onPageDone ).toHaveBeenCalledTimes( 1 )
			);

			return clock.waits.length;
		};

		const lowEnduranceTicks = await runUntilDone( 0 );
		const highEnduranceTicks = await runUntilDone( 10 );

		expect( highEnduranceTicks ).toBeGreaterThan( lowEnduranceTicks );
	} );

	it( 'stop() prevents any further ticks', async () => {
		const onPageDone = vi.fn();
		const motor = new FakeMotor();
		const loop = new SurfLoop( {
			behaviors: [ new ScrollBurst(), new MoveOn() ],
			motor,
			clock: new FakeClock(),
			rng: neutralRng,
			traits: [ 0, 0, 0, 0, 0 ],
			affordances: openAffordances,
			speed: 1,
			onPageDone,
		} );

		loop.start();
		loop.stop();

		await new Promise( ( resolve ) => setTimeout( resolve, 10 ) );

		expect( onPageDone ).not.toHaveBeenCalled();
	} );
} );
