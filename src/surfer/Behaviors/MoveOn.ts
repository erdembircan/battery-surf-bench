/**
 * Leaving the page, modeled as a behavior like any other. Its bid is the
 * accumulated boredom rather than the usual drive/affordance formula —
 * boredom is a pressure that only ever grows, so there is no trait-derived
 * drive or page affordance to multiply in. When this behavior wins, the
 * surfer leaves; `SurfLoop` recognizes the win by key and ends the page
 * session instead of calling `run`.
 */

import type { Behavior } from '../Behavior';

/** The key `SurfLoop` watches for to know the page session is over. */
export const MOVE_ON_KEY = 'moveOn';

export class MoveOn implements Behavior {
	readonly key = MOVE_ON_KEY;

	bid( ...args: Parameters< Behavior[ 'bid' ] > ): number {
		const [ , , boredom ] = args;
		return Math.max( 0, boredom );
	}

	run(): Promise< void > {
		// No motion: SurfLoop halts and fires onPageDone when this behavior wins.
		return Promise.resolve();
	}
}
