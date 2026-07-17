/**
 * Builds a fresh {@link BehaviorContext} for a single moment: re-senses the
 * page's affordances and derives `elapsedMs` from a clock and a reference
 * start time. Shared by `SurfLoop` (the auction tick loop) and `SterileHelm`
 * (a steered, sterile run) so both build a behavior's context the exact same
 * way — sensing must never drift between the two engine paths, or a behavior
 * bid/run tuned against one would read the page differently under the other.
 */

import type { BehaviorContext } from './Behavior';
import type { Clock } from './Clock';
import type { Rng } from './Rng';
import type { Affordances } from './Affordances';

/** The pieces a fresh {@link BehaviorContext} is built from. */
export interface PageSenseDeps {
	traits: readonly number[];
	/** Re-read on every call, so `scrollRemaining` reflects the surfer's own scrolling. */
	senseAffordances: () => Affordances;
	rng: Rng;
	clock: Clock;
	speed: number;
}

/**
 * Builds a fresh {@link BehaviorContext}: re-senses affordances and derives
 * `elapsedMs` as the engine-time elapsed since `startedAt` (real elapsed ×
 * `speed`).
 *
 * @param deps      The context's traits, affordance sensor, rng, clock and speed.
 * @param startedAt The clock reading (via `deps.clock.now()`) the caller's
 *                  session began at, so `elapsedMs` is relative to it.
 * @return A freshly-sensed behavior context.
 */
export const buildBehaviorContext = (
	deps: PageSenseDeps,
	startedAt: number
): BehaviorContext => {
	const { traits, senseAffordances, rng, clock, speed } = deps;

	return {
		traits,
		affordances: senseAffordances(),
		rng,
		clock,
		speed,
		elapsedMs: ( clock.now() - startedAt ) * speed,
	};
};
