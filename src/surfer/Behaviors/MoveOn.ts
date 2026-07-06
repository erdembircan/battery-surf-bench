/**
 * Leaving the page, modeled as a behavior like any other. Its bid follows the
 * same `drive × affordance` algebra every other behavior uses: boredom is the
 * drive (a pressure that only ever grows, with no trait scaling it) and
 * leave-readiness is the affordance — a ramp from `0` to `1` over time on
 * page, rather than a page-sensed value. Below `MIN_DWELL_MS` of engine time
 * the surfer cannot leave at all, whatever boredom has accumulated; the ramp
 * reaches full leave pressure by `MIN_DWELL_MS + LEAVE_RAMP_MS`. When this
 * behavior wins, the surfer leaves; `SurfLoop` recognizes the win by key and
 * ends the page session instead of calling `run`.
 */

import type { Behavior } from '../Behavior';
import { clamp01 } from '../Bid';

/** The key `SurfLoop` watches for to know the page session is over. */
export const MOVE_ON_KEY = 'moveOn';

/** Engine-time dwell before leaving becomes possible at all (knowledge-base floor: the shortest researched dwell, `links` at 12 s). */
export const MIN_DWELL_MS = 12000;

/** Ramp from first leave-readiness to full leave pressure. */
export const LEAVE_RAMP_MS = 8000;

export class MoveOn implements Behavior {
	readonly key = MOVE_ON_KEY;

	bid( ...args: Parameters< Behavior[ 'bid' ] > ): number {
		const [ ctx, , boredom ] = args;
		const leaveReadiness = clamp01(
			( ctx.elapsedMs - MIN_DWELL_MS ) / LEAVE_RAMP_MS
		);
		return Math.max( 0, boredom ) * leaveReadiness;
	}

	run(): Promise< void > {
		// No motion: SurfLoop halts and fires onPageDone when this behavior wins.
		return Promise.resolve();
	}
}
