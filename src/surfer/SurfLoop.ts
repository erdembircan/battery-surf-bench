/**
 * The orchestrator. Owns the tick loop, boredom, and appetite —
 * behaviors themselves stay stateless pure bidders. Each tick: collect bids,
 * draw a winner, run it — a behavior that barks calls the `announce` callback
 * passed into its `run()`, once, at the moment it knows its own wall-clock
 * dwell, and that forwards to `onBehaviorRun` with the winner's key and
 * duration (so the cockpit's bark can hold for exactly that long) — accrue
 * appetite/boredom by how much sim time the iteration actually cost (not a
 * flat step, so a long-running behavior can't starve leave pressure), wait
 * the tempo-scaled interval. When `MoveOn` wins, the loop halts and notifies
 * `onBehaviorRun` with a fixed short display duration (it has no dwell of its
 * own) before firing `onPageDone`.
 */

import type { Behavior, BehaviorContext } from './Behavior';
import { ENDURANCE, TEMPO } from './Behavior';
import type { Motor } from './Motor';
import type { Clock } from './Clock';
import type { Rng } from './Rng';
import type { Affordances } from './Affordances';
import { Appetite } from './Appetite';
import { pickBehavior } from './Arbiter';
import { MOVE_ON_KEY, MOVE_ON_DISPLAY_MS } from './Behaviors/MoveOn';
import { tickIntervalMs } from './Tempo';
import { MAX } from '../shared/SurferStats';
import { buildBehaviorContext } from './PageSense';

/** Boredom gained per tick at zero endurance. */
const BOREDOM_RATE = 0.04;

/** How much endurance damps boredom growth, at full endurance. */
const ENDURANCE_DAMP = 0.85;

/** Settle beat before the first tick, jittered (knowledge-base convention). */
const SETTLE_MS_MIN = 1000;
const SETTLE_MS_MAX = 3000;

// Re-exported so existing importers (this module's own tests, `SterileHelm`)
// keep a single source for the auction's fixed moveOn display duration —
// see `./Behaviors/MoveOn`, which now owns the constant since it describes
// that behavior's own display, not the loop's.
export { MOVE_ON_DISPLAY_MS };

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
	 * Notified with the auction winner's key and its wall-clock dwell in ms
	 * (via that winner's own `announce` callback, or a fixed display duration
	 * for `moveOn`) so the cockpit can bark a flavor quip, held for exactly
	 * that long, for the novelty ones. Optional so existing tests and callers
	 * stay valid without wiring it. Behaviors that never call `announce` (the
	 * mechanical scrollBurst/microScroll/fidgetWiggle) simply never notify —
	 * correct, they don't bark.
	 */
	onBehaviorRun?: ( key: string, durationMs?: number ) => void;
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
		return buildBehaviorContext( this.deps, this.startedAt );
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
				if ( winner.key === MOVE_ON_KEY ) {
					this.running = false;
					this.deps.onBehaviorRun?.(
						MOVE_ON_KEY,
						MOVE_ON_DISPLAY_MS
					);
					this.deps.onPageDone();
					break;
				}

				await winner.run(
					this.deps.motor,
					ctx,
					( durationMs ) =>
						this.deps.onBehaviorRun?.( winner.key, durationMs )
				);
				this.appetite.consume( winner.key );
			}

			const interval = tickIntervalMs( ctx.traits[ TEMPO ] ?? 0 );

			// Elapsed sim time since the last accrual, expressed in units of
			// this iteration's own tick interval — the surfer's natural beat
			// is the reference unit, so a normal, fast-resolving iteration
			// still counts as ~1 "tick", while a behavior that runs far
			// longer than one tick (e.g. watchVideo's tens-of-seconds dwell
			// against a ~1s tick) counts as the many ticks' worth of leave
			// pressure and appetite recovery it actually cost in wall-clock
			// terms. Without this, a long-running behavior would starve the
			// loop and produce almost no boredom growth for the real time it
			// held the page, letting it re-win indefinitely with nothing to
			// stop it.
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
