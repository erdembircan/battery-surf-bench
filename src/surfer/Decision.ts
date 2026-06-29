/**
 * The surf engine's decision core — utility-based action selection. Each tick of
 * a visit the surfer takes ONE action; this scores every *available* action from
 * the trait vector and the current context, then picks one weighted by score, so
 * behaviour EMERGES from the traits rather than from hard-coded branches.
 *
 * The key rule: an action's score comes from ITS trait, and is live the whole
 * visit — `regress` (re-reading) is driven by Recall everywhere, not triggered
 * by reaching the bottom. Context only gates *availability*: `advance` drops out
 * at the target depth / page bottom, `regress` at the top, `watch`/`replay`
 * exist only on the video page. The dominant trait wins most ticks; the others
 * still surface (weighted-random) — the "barking" arbitration from the research.
 *
 * Pure and framework-free: scoring and selection are plain functions of the
 * context (and an injectable RNG), so the behaviour can be unit-tested without a
 * DOM or a real run. The executor ({@link ./Surfer}) carries the chosen action out.
 */

import { type PageType } from './PageModel';

/** One thing the surfer can do on a tick. */
export type ActionKind = 'advance' | 'dwell' | 'regress' | 'watch' | 'replay';

/** The runtime context the action scores read. */
export interface SurfContext {
	/** The six-stat trait vector. */
	traits: readonly number[];
	/** The page archetype. */
	pageType: PageType;
	/** Whether the scroll is at the very top (gates `regress`). */
	atTop: boolean;
	/** Whether the reading depth has been reached (gates `advance`). */
	atTarget: boolean;
	/** Whether the scroll is at the page bottom (gates `advance`). */
	atBottom: boolean;
	/** Whether the video has been watched at least once (gates `replay`). */
	watched: boolean;
}

/** An action and the utility it scored for the current context. */
export interface ScoredAction {
	kind: ActionKind;
	score: number;
}

/**
 * A stat's normalized strength, 0–1.
 * @param traits
 * @param index
 */
const norm = ( traits: readonly number[], index: number ): number =>
	( traits[ index ] ?? 0 ) / 10;

/**
 * Scores the actions available in the given context. Only available actions are
 * returned (context gates availability); each score comes from the action's
 * driving trait. An empty-ish page still yields `dwell` so there is always a
 * choice.
 * @param ctx
 */
export const scoreActions = ( ctx: SurfContext ): ScoredAction[] => {
	const haste = norm( ctx.traits, 0 );
	const literacy = norm( ctx.traits, 3 );
	const recall = norm( ctx.traits, 4 );
	const allure = norm( ctx.traits, 5 );

	const actions: ScoredAction[] = [];

	// `dwell` (read in place) is not a competing action — reading is the pause
	// built into a move (length set by Literacy in Behavior). It is only the
	// fallback when nothing else is available (see selectAction): at the bottom
	// with no Recall, the surfer simply absorbs the final view. Modelling it as a
	// competitor would let a high-Literacy reader pick it forever and never move.

	if ( ctx.pageType === 'video' ) {
		// Allure pulls toward watching and replaying; the leftover drive scrolls
		// the supplemental copy; Recall re-reads it.
		actions.push( { kind: 'watch', score: 0.2 + allure * 1.2 } );
		if ( ctx.watched ) {
			actions.push( {
				kind: 'replay',
				score: Math.max( 0, allure - 0.5 ),
			} );
		}
		if ( ! ctx.atBottom ) {
			actions.push( {
				kind: 'advance',
				score: 0.15 + ( 1 - allure ) * 0.35,
			} );
		}
		if ( ! ctx.atTop ) {
			actions.push( { kind: 'regress', score: recall * 0.4 } );
		}
	} else {
		// Reading pages. `advance` is the spine — available until the bottom — but
		// its drive drops sharply once the Reach depth is reached, so a shallow
		// surfer lingers/re-reads around its depth while a deep one carries on.
		// Skimmers (low Literacy, high Haste) advance hardest. `regress` re-reads,
		// driven by Recall, available the whole page (not gated on the bottom).
		if ( ! ctx.atBottom ) {
			const drive = ctx.atTarget ? 0.1 : 0.6;
			actions.push( {
				kind: 'advance',
				score: drive + ( 1 - literacy ) * 0.5 + haste * 0.2,
			} );
		}
		if ( ! ctx.atTop ) {
			actions.push( { kind: 'regress', score: recall * 0.9 } );
		}
	}

	return actions.filter( ( action ) => action.score > 0 );
};

/**
 * Picks one action weighted by its score — the dominant trait wins most ticks
 * while lesser ones still surface. Deterministic given the RNG, so it can be
 * tested. Falls back to `dwell` when nothing is available.
 * @param scored
 * @param rng    Returns a float in [0, 1); defaults to Math.random.
 */
export const selectAction = (
	scored: readonly ScoredAction[],
	rng: () => number = Math.random
): ActionKind => {
	if ( scored.length === 0 ) {
		return 'dwell';
	}

	const total = scored.reduce( ( sum, action ) => sum + action.score, 0 );
	let threshold = rng() * total;

	for ( const action of scored ) {
		threshold -= action.score;
		if ( threshold <= 0 ) {
			return action.kind;
		}
	}

	return scored[ scored.length - 1 ].kind;
};
