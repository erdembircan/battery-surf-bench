/**
 * The course page as the surf engine sees it: its type (which decides the shape
 * of the visit) and the on-page content the engine acts on — the text blocks it
 * reads, the figures it lingers on, and the video it watches. The selectors
 * mirror the course content markup (`.bsb-course-content` and the per-type
 * structures); finding targets is kept separate from driving them so it can be
 * tested against fixtures without a live page.
 */

/** A course page archetype — the slugs collapse to these four shapes. */
export type PageType = 'article' | 'gallery' | 'video' | 'links';

/** The content the engine can act on for one page. */
export interface PageTargets {
	type: PageType;
	/** Headings and paragraphs — the reading targets. */
	text: HTMLElement[];
	/** Figures/illustrations — gallery and inline-chart targets. */
	figures: HTMLElement[];
	/** The embedded video player, when the page has one. */
	video: HTMLIFrameElement | null;
}

/**
 * Maps a course slug to its page type. Both article slugs are `article`;
 * anything unrecognized falls back to `article` (a plain reading visit).
 * @param slug
 */
export const pageTypeFor = ( slug: string ): PageType => {
	if ( slug === 'gallery' ) {
		return 'gallery';
	}
	if ( slug === 'video' ) {
		return 'video';
	}
	if ( slug === 'links' ) {
		return 'links';
	}

	return 'article';
};

/**
 * Finds the engine's content targets on a course document.
 * @param doc  The course page document.
 * @param slug The course slug, used to type the page.
 */
export const findTargets = ( doc: Document, slug: string ): PageTargets => {
	const root: ParentNode =
		doc.querySelector( '.bsb-course-content' ) ?? doc.body;

	return {
		type: pageTypeFor( slug ),
		text: Array.from(
			root.querySelectorAll< HTMLElement >( 'h1, h2, h3, p' )
		),
		figures: Array.from( root.querySelectorAll< HTMLElement >( 'figure' ) ),
		video: doc.querySelector< HTMLIFrameElement >( 'iframe#bsb-yt' ),
	};
};
