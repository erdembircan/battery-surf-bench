/**
 * The contract every surf action implements. Behaviors are never called
 * directly — each tick they bid in an auction, and the arbiter draws a
 * winner. A behavior's `bid` must stay a pure function of its
 * inputs (no side effects, no branching on identity), so the arbiter can
 * treat every behavior identically regardless of what it does when it wins.
 */

import type { Rng } from './Rng';
import type { Clock } from './Clock';
import type { Affordances } from './Affordances';
import type { Motor } from './Motor';
import { STATS, type StatKey } from '../shared/SurferStats';

/**
 * Index of each stat within the trait vector, derived from the shared
 * `SurferStats` `STATS` order so a reorder there can never silently desync
 * a behavior from the vector it reads.
 */
const STAT_INDEX = Object.fromEntries(
	STATS.map( ( stat, index ) => [ stat.key, index ] )
) as Record< StatKey, number >;

export const TEMPO = STAT_INDEX.tempo;
export const ENDURANCE = STAT_INDEX.endurance;
export const LITERACY = STAT_INDEX.literacy;
export const ALLURE = STAT_INDEX.allure;
export const FIDGET = STAT_INDEX.fidget;

/** Everything a behavior's `bid`/`run` needs, rebuilt fresh every tick. */
export interface BehaviorContext {
	traits: readonly number[];
	affordances: Affordances;
	rng: Rng;
	clock: Clock;
	speed: number;
	/** Engine-time milliseconds since the loop started (real elapsed × `speed`). */
	elapsedMs: number;
}

/**
 * Called once from inside run(), at the moment the behavior knows how long
 * it will hold the stage (its wall-clock dwell in ms), before awaiting — so
 * the cockpit's bark countdown matches the actual dwell exactly. Same single
 * rng draw; never sample twice.
 */
export type BehaviorAnnounce = ( durationMs: number ) => void;

/** One action the surfer can bid to perform. */
export interface Behavior {
	/** Stable identity used for appetite bookkeeping. */
	readonly key: string;
	/** Pure bid score for the current tick — never a side effect. */
	bid: ( ctx: BehaviorContext, appetite: number, boredom: number ) => number;
	/** Performs the action through `motor` once this behavior wins the tick. */
	run: (
		motor: Motor,
		ctx: BehaviorContext,
		announce?: BehaviorAnnounce
	) => Promise< void >;
}
