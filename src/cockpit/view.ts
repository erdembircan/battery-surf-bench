/**
 * Cockpit view — the Interactivity API store backing the `bsb/cockpit` block.
 *
 * The block's PHP render seeds a per-instance context with the surfable course
 * pages and the active index; this store derives the URL the viewport iframe
 * shows from that context and exposes it as reactive state. Pointing the iframe
 * through state (rather than a fixed `src`) is what lets the active page move
 * client-side later — the configuration controls and run state will extend this
 * same store as the cockpit grows.
 */

import { store, getContext } from '@wordpress/interactivity';

/** One surfable course page, as supplied by the `bsb/course-pages` binding. */
interface CoursePage {
	slug: string;
	title: string;
	url: string;
}

/** Per-instance context the cockpit's PHP render seeds onto the block. */
interface CockpitContext {
	pages: CoursePage[];
	activeIndex: number;
}

store( 'bsb/cockpit', {
	state: {
		/** URL of the active course page, bound onto the viewport iframe. */
		get currentSrc(): string {
			const { pages, activeIndex } = getContext< CockpitContext >();

			return pages[ activeIndex ]?.url ?? '';
		},
	},
} );
