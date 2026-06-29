/**
 * Trait → behaviour mapping: how a surfer's six stats become the concrete knobs
 * the engine uses to surf one page. This is where the personality is reflected
 * ON the page — Endurance/Literacy stretch the dwell and reading pauses, Reach
 * sets how far down it scrolls, Haste sets scroll speed and cadence, Recall the
 * re-read scroll-ups, and Allure the video watch and replay.
 *
 * Speed is the VHS fast-forward: it divides only the TIME knobs (dwell, scroll
 * gap, reading pause) so the surfer does the same things, faster. Counts, pixel
 * sizes, depths and probabilities never scale with speed — ×1 stays the only
 * valid measurement mode. The numbers are derived from the research base in
 * docs/knowledge-base/surf-behavior-profile.md, modulated by the stats.
 */

import { type PageType } from './PageModel';

/** The behaviour knobs for one page visit (time knobs already speed-scaled). */
export interface Behavior {
	/** Total time on the page, ms. */
	dwellMs: number;
	/** Fraction of the scrollable height to reach, 0–1. */
	scrollDepth: number;
	/** Pixels per eased scroll burst. */
	burstPx: number;
	/** Pause between scroll bursts, ms. */
	burstGapMs: number;
	/** Probability a burst gap becomes a long reading pause, 0–1. */
	readingPauseChance: number;
	/** Length of a reading pause, ms. */
	readingPauseMs: number;
	/** Probability of a re-read scroll-up after a pause, 0–1. */
	scrollUpChance: number;
	/** Fraction of the video the surfer watches, 0–1. */
	videoWatchFraction: number;
	/** Probability the surfer replays the video, 0–1. */
	videoReplayChance: number;
}

/**
 * Clamps to the 0–1 range.
 * @param value
 */
const clamp01 = ( value: number ): number =>
	Math.max( 0, Math.min( 1, value ) );

/**
 * How text-heavy a page is — scales reading-driven behaviour down on pages with
 * little to read (gallery/video light, links medium, articles full).
 * @param type
 */
const textWeightFor = ( type: PageType ): number => {
	if ( type === 'article' ) {
		return 1;
	}
	if ( type === 'video' || type === 'gallery' ) {
		return 0.3;
	}

	return 0.5;
};

/**
 * Derives the behaviour for a page from the trait vector and the demo speed.
 * @param traits The six-stat vector `[haste, endurance, reach, literacy, recall, allure]`.
 * @param type   The page archetype.
 * @param speed  The demo speed multiplier (divides the time knobs); defaults to 1×.
 */
export const behaviorFor = (
	traits: readonly number[],
	type: PageType,
	speed = 1
): Behavior => {
	const [
		haste = 0,
		endurance = 0,
		reach = 0,
		literacy = 0,
		recall = 0,
		allure = 0,
	] = traits;

	const isArticle = type === 'article';
	const isVideo = type === 'video';
	const isGallery = type === 'gallery';
	const textWeight = textWeightFor( type );

	// Base dwell grows with Endurance; reading stretches it on articles, the
	// video pull stretches it on the video page, images a little on galleries.
	let dwellSec = 8 + endurance * 5;
	if ( isArticle ) {
		dwellSec += literacy * 3;
	}
	if ( isVideo ) {
		dwellSec += allure * 4;
	}
	if ( isGallery ) {
		dwellSec += allure * 2;
	}

	const safeSpeed = speed > 0 ? speed : 1;

	return {
		// Time knobs — divided by speed (fast-forward).
		dwellMs: ( dwellSec * 1000 ) / safeSpeed,
		burstGapMs: Math.max( 600, 4000 - haste * 300 ) / safeSpeed,
		readingPauseMs: ( 1000 + literacy * 1500 ) / safeSpeed,

		// Untimed knobs — never scale with speed.
		scrollDepth: clamp01( 0.2 + reach * 0.07 ),
		burstPx: 300 + haste * 60,
		readingPauseChance: clamp01( literacy * 0.08 * textWeight ),
		scrollUpChance: clamp01( recall * 0.06 * textWeight ),
		videoWatchFraction: isVideo ? clamp01( 0.1 + allure * 0.09 ) : 0,
		videoReplayChance: isVideo
			? clamp01( Math.max( 0, allure - 5 ) * 0.1 )
			: 0,
	};
};
