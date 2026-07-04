import type { BehaviorContext } from './Behavior';
import type { Affordances } from './Affordances';
import type { Clock } from './Clock';

/** An rng stub that neutralizes bid noise to exactly `1` (see `Bid.noise`). */
export const neutralRng = (): number => 0.5;

/** Affordances with everything wide open, so a behavior's own gate is what's tested. */
export const openAffordances: Affordances = {
	scrollRemaining: 1,
	textDensity: 1,
	hasVideo: true,
	imageCount: 4,
};

const instantClock: Clock = { wait: () => Promise.resolve() };

/**
 * Builds a {@link BehaviorContext} for a bid/run test, with sane defaults
 * that can be overridden per case.
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
	...overrides,
} );
