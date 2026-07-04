/**
 * What the page offers, sensed once from the DOM when the engine boots
 * (plan §3.5). Behaviors read this instead of branching on "what kind of
 * page is this" — a page with no `<video>` simply has `hasVideo: false`,
 * which zeroes `WatchVideo`'s bid by multiplication, never by a gate.
 */

import { clamp01 } from './Bid';

export interface Affordances {
	/** Fraction (0–1) of the scrollable height still below the fold. */
	scrollRemaining: number;
	/** Rough share (0–1) of the page that reads as prose. */
	textDensity: number;
	/** Whether the page has a `<video>` element. */
	hasVideo: boolean;
	/** Number of `<img>` elements on the page. */
	imageCount: number;
}

/** Body text length, in characters, at which `textDensity` saturates to 1. */
const TEXT_DENSITY_SATURATION_CHARS = 1200;

/**
 * Reads {@link Affordances} from the live document.
 * @param doc
 */
export const senseAffordances = ( doc: Document ): Affordances => {
	const root = doc.scrollingElement ?? doc.documentElement;
	const scrollable = Math.max( 0, root.scrollHeight - root.clientHeight );
	const scrollRemaining =
		scrollable > 0
			? clamp01( ( scrollable - root.scrollTop ) / scrollable )
			: 0;

	const charCount = doc.body?.textContent?.trim().length ?? 0;
	const textDensity = clamp01( charCount / TEXT_DENSITY_SATURATION_CHARS );

	return {
		scrollRemaining,
		textDensity,
		hasVideo: doc.querySelectorAll( 'video' ).length > 0,
		imageCount: doc.querySelectorAll( 'img' ).length,
	};
};
