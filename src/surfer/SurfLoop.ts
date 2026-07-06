/**
 * The orchestrator. Owns the tick loop, boredom, and appetite —
 * behaviors themselves stay stateless pure bidders. Each tick: collect bids,
 * draw a winner, notify `onBehaviorRun` with its key (so the cockpit can bark
 * a flavor quip for the novelty ones), run it, accrue appetite/boredom by how
 * much sim time the iteration actually cost (not a flat step, so a
 * long-running behavior can't starve leave pressure), wait the tempo-scaled
 * interval. When `MoveOn` wins, the loop halts and fires `onPageDone` (after
 * notifying `onBehaviorRun`, so `moveOn` barks too).
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
	/**
	 * Notified with the auction winner's key as each behavior begins its
	 * `run()`, so the cockpit can bark a flavor quip for the novelty ones.
	 * Optional so existing tests and callers stay valid without wiring it.
	 */
	onBehaviorRun?: ( key: string ) => void;
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

		// Marks the clock time boredom/appetite were last accrued from, so
		// each iteration can charge for the sim time that actually passed
		// since then — the winner's own run duration plus the tick wait that
		// followed the previous iteration — rather than a flat one tick
		// regardless of how long that iteration took. Initialized here, after
		// the settle wait, so the settle beat itself never pre-charges
		// boredom before the surfer has taken a single action.
		let lastTickAt = clock.now();

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
				this.deps.onBehaviorRun?.( winner.key );

				if ( winner.key === MOVE_ON_KEY ) {
					this.running = false;
					this.deps.onPageDone();
					break;
				}

				await winner.run( this.deps.motor, ctx );
				this.appetite.consume( winner.key );
			}

			const interval = tickIntervalMs( ctx.traits[ TEMPO ] ?? 0 );

			// Elapsed sim time since the last accrual, expressed in units of
			// this iteration's own tick interval — the surfer's natural beat
			// is the reference unit, so a normal, fast-resolving iteration
			// still counts as ~1 "tick", while a behavior that runs far
			// longer than one tick (e.g. watchVideo's 60-90s dwell against a
			// ~1s tick) counts as the many ticks' worth of leave pressure and
			// appetite recovery it actually cost in wall-clock terms. Without
			// this, a long-running behavior would starve the loop and
			// produce almost no boredom growth for the real time it held the
			// page, letting it re-win indefinitely with nothing to stop it.
			const dtMs = ( clock.now() - lastTickAt ) * speed;
			lastTickAt = clock.now();
			const steps = dtMs / interval;

			this.appetite.recover( steps );
			this.boredom +=
				BOREDOM_RATE *
				steps *
				( 1 -
					ENDURANCE_DAMP *
						( ( ctx.traits[ ENDURANCE ] ?? 0 ) / MAX ) );

			await clock.wait( interval / speed );
		}
	}
}
