/**
 * Selection over the tick's bids — a roulette wheel, never argmax. Argmax
 * would let one high stat rule out everything else, exactly what the RPG
 * design rejects; a weighted random draw lets a weak bid still occasionally
 * win, and a zero bid still never can.
 */

import type { Behavior } from './Behavior';
import type { Rng } from './Rng';

/** One behavior's bid for the current tick. */
export interface Ballot {
	b: Behavior;
	bid: number;
}

/**
 * Draws a winner proportional to each positive bid. Negative bids count as
 * zero. Returns `null` when every bid is zero or the list is empty.
 * @param bids
 * @param rng
 */
export const pickBehavior = (
	bids: ReadonlyArray< Ballot >,
	rng: Rng
): Behavior | null => {
	const total = bids.reduce(
		( sum, { bid } ) => sum + Math.max( 0, bid ),
		0
	);

	if ( total <= 0 ) {
		return null;
	}

	const draw = rng() * total;
	let cumulative = 0;
	let lastPositive: Behavior | null = null;

	for ( const { b, bid } of bids ) {
		const weight = Math.max( 0, bid );
		if ( weight <= 0 ) {
			continue;
		}

		cumulative += weight;
		lastPositive = b;
		if ( draw < cumulative ) {
			return b;
		}
	}

	// Floating-point rounding can leave `draw` at or past `total`; the last
	// positive-bid entry is the correct winner in that edge case.
	return lastPositive;
};
