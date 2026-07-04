/**
 * The contract every surf action implements. Behaviors are never called
 * directly — each tick they bid in an auction (plan §3.1/§3.2), and the
 * arbiter draws a winner. A behavior's `bid` must stay a pure function of its
 * inputs (no side effects, no branching on identity), so the arbiter can
 * treat every behavior identically regardless of what it does when it wins.
 */

import type { Rng } from './Rng';
import type { Clock } from './Clock';
import type { Affordances } from './Affordances';
import type { Motor } from './Motor';

/**
 * Index of each stat within the trait vector — mirrors the fixed `STATS`
 * order in the shared `SurferStats` module, the contract shared with the
 * cockpit.
 */
export const TEMPO = 0;
export const ENDURANCE = 1;
export const LITERACY = 2;
export const ALLURE = 3;
export const FIDGET = 4;

/** Everything a behavior's `bid`/`run` needs, refreshed once the page loads. */
export interface BehaviorContext {
	traits: readonly number[];
	affordances: Affordances;
	rng: Rng;
	clock: Clock;
	speed: number;
}

/** One action the surfer can bid to perform. */
export interface Behavior {
	/** Stable identity used for appetite bookkeeping. */
	readonly key: string;
	/** Pure bid score for the current tick — never a side effect. */
	bid: ( ctx: BehaviorContext, appetite: number, boredom: number ) => number;
	/** Performs the action through `motor` once this behavior wins the tick. */
	run: ( motor: Motor, ctx: BehaviorContext ) => Promise< void >;
}
