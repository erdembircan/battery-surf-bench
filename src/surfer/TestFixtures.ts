import type { BehaviorContext } from '@/surfer/Behavior';
import type { Affordances } from '@/surfer/Affordances';
import type { Clock } from '@/surfer/Clock';

/** An rng stub that neutralizes bid noise to exactly `1` (see `Bid.noise`). */
export const neutralRng = (): number => 0.5;

/** Affordances with everything wide open, so a behavior's own gate is what's tested. */
export const openAffordances: Affordances = {
	scrollRemaining: 1,
	textDensity: 1,
	hasVideo: true,
	imageCount: 4,
};

const instantClock: Clock = { wait: () => Promise.resolve(), now: () => 0 };

/**
 * Builds a {@link BehaviorContext} for a bid/run test, with sane defaults
 * that can be overridden per case. `elapsedMs` defaults well past `MoveOn`'s
 * leave-readiness ramp, so every other behavior's tests are unaffected by the
 * dwell floor; `MoveOn`'s own tests override it explicitly.
 * @param traits
 * @param overrides
 */
export const makeContext = (
	traits: readonly number[],
	overrides: Partial< BehaviorContext > = {}
): BehaviorContext => ( {
	traits,
	affordances: openAffordances,
	rng: neutralRng,
	clock: instantClock,
	speed: 1,
	elapsedMs: 60000,
	...overrides,
} );
