/**
 * Trait → behaviour MAGNITUDES: how big/long each action is when the surfer
 * takes it. This is deliberately NOT where actions are chosen — that is the
 * decision core ({@link ./Decision}), which scores the competing actions from
 * the traits and selects one. Here a stat only sizes the action it influences:
 * Haste the burst distance and cadence, Literacy the reading-pause length,
 * Endurance (with Literacy/Allure) the page dwell, Reach the depth the surfer
 * bothers to scroll to.
 *
 * Speed is the VHS fast-forward: it divides only the TIME magnitudes (dwell,
 * gap, pause) so the surfer does the same things, faster. Pixel sizes and the
 * depth fraction never scale with speed — ×1 stays the only valid measurement
 * mode. Numbers derive from docs/knowledge-base/surf-behavior-profile.md.
 */

import { type PageType } from './PageModel';

/** The magnitudes an action uses (time magnitudes already speed-scaled). */
export interface Behavior {
	/** Total time on the page, ms — the visit's deadline budget. */
	dwellMs: number;
	/** Fraction of the scrollable height the surfer bothers to reach, 0–1. */
	scrollDepth: number;
	/** Pixels per scroll burst (advance or regress). */
	burstPx: number;
	/** Gap after a scroll burst, ms. */
	burstGapMs: number;
	/** Length of a reading dwell / viewing beat, ms. */
	readingPauseMs: number;
}

/**
 * Clamps to the 0–1 range.
 * @param value
 */
const clamp01 = ( value: number ): number =>
	Math.max( 0, Math.min( 1, value ) );

/**
 * Derives the action magnitudes for a page from the trait vector and the demo
 * speed.
 * @param traits The six-stat vector `[haste, endurance, reach, literacy, recall, allure]`.
 * @param type   The page archetype.
 * @param speed  The demo speed multiplier (divides the time magnitudes); defaults to 1×.
 */
export const behaviorFor = (
	traits: readonly number[],
	type: PageType,
	speed = 1
): Behavior => {
	const [ haste = 0, endurance = 0, reach = 0, literacy = 0, , allure = 0 ] =
		traits;

	// The dwell grows with Endurance; reading stretches it on articles, the video
	// pull stretches it on the video page, images a little on galleries.
	let dwellSec = 8 + endurance * 5;
	if ( type === 'article' ) {
		dwellSec += literacy * 3;
	} else if ( type === 'video' ) {
		dwellSec += allure * 4;
	} else if ( type === 'gallery' ) {
		dwellSec += allure * 2;
	}

	const safeSpeed = speed > 0 ? speed : 1;

	return {
		// Time magnitudes — divided by speed (fast-forward).
		dwellMs: ( dwellSec * 1000 ) / safeSpeed,
		burstGapMs: Math.max( 600, 4000 - haste * 300 ) / safeSpeed,
		readingPauseMs: ( 1000 + literacy * 1500 ) / safeSpeed,

		// Untimed magnitudes — never scale with speed.
		scrollDepth: clamp01( 0.2 + reach * 0.07 ),
		burstPx: 300 + haste * 60,
	};
};
