/**
 * What the page offers, sensed fresh from the DOM every tick. Behaviors read
 * this instead of branching on "what kind of page is this" — a page with no
 * `<video>` simply has `hasVideo: false`, which zeroes `WatchVideo`'s bid by
 * multiplication, never by a gate.
 *
 * Media and text sensing is scoped to the page's content root (`<main>` where
 * the theme renders one, else `<body>`) rather than the whole document — page
 * chrome outside it (the admin bar, a theme logo, emoji `<img>` replacements)
 * is never content imagery or prose. `scrollRemaining` stays whole-page (via
 * `scrollingElement`), since scroll progress is genuinely global.
 */

import { clamp01 } from './Bid';

export interface Affordances {
	/** Fraction (0–1) of the scrollable height still below the fold. */
	scrollRemaining: number;
	/** Rough share (0–1) of the content that reads as prose. */
	textDensity: number;
	/** Whether the content has a `<video>` or a recognized video-host embed. */
	hasVideo: boolean;
	/** Number of `<img>` elements and SVG figures in the content. */
	imageCount: number;
}

/** Content text length, in characters, at which `textDensity` saturates to 1. */
const TEXT_DENSITY_SATURATION_CHARS = 1200;

/**
 * Matches a recognized video-host embed iframe (YouTube or Vimeo). Exported
 * as the single source of this rule — {@link ./Motor}'s `DomMotor` reads it
 * too, when targeting the same embed to attend and play, so a new host is
 * added in one place, never two.
 *
 * Detection is unchanged by the move to genuinely controllable playback: a
 * native `core/embed` YouTube block still renders as a `youtube.com/embed`
 * or `youtube-nocookie.com/embed` iframe on the front end (see
 * `YouTubeEmbed.php`), so this selector matches it exactly as it always has.
 * What changed is what `DomMotor.playVideo`/`stopVideo` now do with the
 * match — see `./VideoControl`.
 */
export const VIDEO_EMBED_SELECTOR =
	'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"], iframe[src*="player.vimeo.com"]';

/**
 * The page's content root: `<main>` where the theme renders one, else
 * `<body>`. Block themes render page content inside `<main>`; the admin bar
 * and theme header/footer chrome live outside it. The single source of this
 * rule — {@link ./Motor}'s `DomMotor.lingerImage` and `.playVideo` also scope
 * their candidate search through this, so the root a behavior is bid on is
 * exactly the root its motor verb searches.
 * @param doc
 */
export const contentRoot = ( doc: Document ): Element =>
	doc.querySelector( 'main' ) ?? doc.body;

/**
 * Reads {@link Affordances} from the live document.
 * @param doc
 */
export const senseAffordances = ( doc: Document ): Affordances => {
	const scrollEl = doc.scrollingElement ?? doc.documentElement;
	const scrollable = Math.max(
		0,
		scrollEl.scrollHeight - scrollEl.clientHeight
	);
	const scrollRemaining =
		scrollable > 0
			? clamp01( ( scrollable - scrollEl.scrollTop ) / scrollable )
			: 0;

	const root = contentRoot( doc );
	const charCount = root.textContent?.trim().length ?? 0;
	const textDensity = clamp01( charCount / TEXT_DENSITY_SATURATION_CHARS );

	return {
		scrollRemaining,
		textDensity,
		hasVideo:
			root.querySelectorAll( 'video' ).length > 0 ||
			root.querySelectorAll( VIDEO_EMBED_SELECTOR ).length > 0,
		// `figure svg`: the gallery page presents its artwork as inline SVG
		// inside `<figure>`, not `<img>`. `picture` is deliberately not added
		// to this selector — a `<picture>` wraps an `<img>` that already
		// matches, and adding it would double-count that same image.
		imageCount: root.querySelectorAll( 'img, figure svg' ).length,
	};
};
