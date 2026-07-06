/**
 * The orchestrator. Owns the tick loop, boredom, and appetite —
 * behaviors themselves stay stateless pure bidders. Each tick: collect bids,
 * draw a winner, run it, update appetite/boredom, wait the tempo-scaled
 * interval. When `MoveOn` wins, the loop halts and fires `onPageDone`.
 */

import type { Behavior, BehaviorContext } from './Behavior';
import { ENDURANCE, TEMPO } from './Behavior';
import type { Motor } from './Motor';
import type { Clock } from './Clock';
import type { Rng } from './Rng';
import type { Affordances } from './Affordances';
import { Appetite } from './Appetite';
import { pickBehavior } from './Arbiter';
import { MOVE_ON_KEY } from './Behaviors/MoveOn';
import { tickIntervalMs } from './Tempo';
import { MAX } from '../shared/SurferStats';

/** Boredom gained per tick at zero endurance. */
const BOREDOM_RATE = 0.04;

/** How much endurance damps boredom growth, at full endurance. */
const ENDURANCE_DAMP = 0.85;

/** Settle beat before the first tick, jittered (knowledge-base convention). */
const SETTLE_MS_MIN = 1000;
const SETTLE_MS_MAX = 3000;

export interface SurfLoopDeps {
	behaviors: Behavior[];
	motor: Motor;
	clock: Clock;
	rng: Rng;
	traits: number[];
	/** Re-read each tick, so `scrollRemaining` reflects the surfer's own scrolling. */
	senseAffordances: () => Affordances;
	speed: number;
	onPageDone: () => void;
}

/** Runs the auction-driven tick loop for a single page visit. */
export class SurfLoop {
	private readonly deps: SurfLoopDeps;
	private readonly appetite = new Appetite();
	private boredom = 0;
	private running = false;
	/** Clock time the loop began at, so each tick can derive `elapsedMs` from it. */
	private startedAt = 0;

	constructor( deps: SurfLoopDeps ) {
		this.deps = deps;
	}

	/** Starts the settle beat, then the tick loop. Idempotent while running. */
	start(): void {
		if ( this.running ) {
			return;
		}
		this.running = true;
		void this.loop();
	}

	/** Halts the loop before its next tick; does not fire `onPageDone`. */
	stop(): void {
		this.running = false;
	}

	private context(): BehaviorContext {
		const { traits, senseAffordances, rng, clock, speed } = this.deps;
		return {
			traits,
			affordances: senseAffordances(),
			rng,
			clock,
			speed,
			elapsedMs: ( clock.now() - this.startedAt ) * speed,
		};
	}

	private async loop(): Promise< void > {
		const { rng, speed, clock } = this.deps;
		this.startedAt = clock.now();
		const settleMs =
			SETTLE_MS_MIN + rng() * ( SETTLE_MS_MAX - SETTLE_MS_MIN );
		await clock.wait( settleMs / speed );

		while ( this.running ) {
			const ctx = this.context();
			const bids = this.deps.behaviors.map( ( b ) => ( {
				b,
				bid: b.bid(
					ctx,
					this.appetite.valueFor( b.key ),
					this.boredom
				),
			} ) );
			const winner = pickBehavior( bids, rng );

			if ( winner ) {
				if ( winner.key === MOVE_ON_KEY ) {
					this.running = false;
					this.deps.onPageDone();
					break;
				}

				await winner.run( this.deps.motor, ctx );
				this.appetite.consume( winner.key );
			}

			this.appetite.recoverTick();
			this.boredom +=
				BOREDOM_RATE *
				( 1 -
					ENDURANCE_DAMP *
						( ( ctx.traits[ ENDURANCE ] ?? 0 ) / MAX ) );

			const interval = tickIntervalMs( ctx.traits[ TEMPO ] ?? 0 );
			await clock.wait( interval / speed );
		}
	}
}
