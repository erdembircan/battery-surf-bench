/**
 * The surf engine's executor: it runs one course page through a human-looking
 * visit by repeatedly asking the decision core ({@link ./Decision}) what to do
 * and carrying it out. It owns NO behaviour logic of its own — which action to
 * take each tick emerges from the trait scores; this class only builds the
 * context, performs the chosen action with the cursor/scroller/video, sizes it
 * from {@link ./Behavior}, and idles between ticks, until the dwell deadline.
 * Then it tells the cockpit the page is done so the next one loads.
 *
 * It is a deadline-budget loop: the dwell bounds the whole visit, the target
 * depth bounds how far down `advance` will go. Durations come pre-scaled by the
 * demo speed from Behavior; the eased burst/glide duration is scaled here too.
 */

import { type RunParams } from './RunParams';
import { findTargets, type PageTargets } from './PageModel';
import { behaviorFor, type Behavior } from './Behavior';
import { scoreActions, selectAction, type SurfContext } from './Decision';
import { Scroller } from './Scroller';
import { Cursor } from './Cursor';
import { VideoWatcher } from './VideoWatcher';
import { pageDone } from './Bridge';

/** Base eased burst/glide duration at 1×, ms. */
const ANIM_MS = 220;

/**
 * Console trace of what the engine is doing, for debugging a run. Tagged so the
 * surfer's actions are easy to follow in the iframe console.
 * @param args
 */
const log = ( ...args: unknown[] ): void => {
	// eslint-disable-next-line no-console -- intentional debug trace for the surf engine.
	console.info( '[bsb-surfer]', ...args );
};

/**
 * Resolves after `ms` (clamped non-negative) using the window's timer.
 * @param ms
 * @param win
 */
const delay = ( ms: number, win: Window ): Promise< void > =>
	new Promise( ( resolve ) => win.setTimeout( resolve, Math.max( 0, ms ) ) );

/** Drives a single course page through one trait-shaped visit. */
export class Surfer {
	private readonly animMs: number;
	private watched = false;

	/**
	 * @param params The validated run parameters (traits, speed, slug).
	 * @param win    The window to drive (defaults to the global).
	 */
	constructor(
		private params: RunParams,
		private win: Window = window
	) {
		this.animMs = ANIM_MS / ( params.speed > 0 ? params.speed : 1 );
	}

	/** Runs the visit, then signals the cockpit to advance the queue. */
	async run(): Promise< void > {
		const targets = findTargets( this.win.document, this.params.slug );
		const behavior = behaviorFor(
			this.params.traits,
			targets.type,
			this.params.speed
		);
		const cursor = new Cursor( this.win );
		const scroller = new Scroller( this.win );
		const watcher = targets.video
			? new VideoWatcher( targets.video )
			: null;
		const targetScroll = scroller.maxScroll * behavior.scrollDepth;
		const deadline = performance.now() + behavior.dwellMs;

		log(
			`▶ ${ this.params.slug } (${
				targets.type
			}) · traits=[${ this.params.traits.join( ',' ) }] · speed=${
				this.params.speed
			}×`
		);
		log(
			`  dwell=${ Math.round(
				behavior.dwellMs
			) }ms depth=${ behavior.scrollDepth.toFixed( 2 ) } burst=${
				behavior.burstPx
			}px`
		);

		try {
			// Settle, then act until the dwell runs out. Each tick the decision
			// core scores the available actions from the traits + context and one
			// is chosen weighted by score — no action is a hard-coded fallback.
			await delay( behavior.burstGapMs, this.win );

			while ( performance.now() < deadline ) {
				const context: SurfContext = {
					traits: this.params.traits,
					pageType: targets.type,
					atTop: scroller.position <= 0,
					atTarget: scroller.position >= targetScroll,
					atBottom: scroller.position >= scroller.maxScroll - 1,
					watched: this.watched,
				};

				const action = selectAction( scoreActions( context ) );
				await this.perform(
					action,
					behavior,
					cursor,
					scroller,
					watcher,
					targets
				);
			}
		} finally {
			log( `■ ${ this.params.slug } done → advancing queue` );
			cursor.destroy();
			pageDone( this.win );
		}
	}

	/**
	 * Carries out one chosen action: sizes it from the behaviour magnitudes and
	 * drives the cursor/scroller/video, then consumes the appropriate beat of the
	 * dwell. The cursor drifts over the content on every action so the surfer is
	 * never visually frozen.
	 * @param action
	 * @param behavior
	 * @param cursor
	 * @param scroller
	 * @param watcher
	 * @param targets
	 */
	private async perform(
		action: ReturnType< typeof selectAction >,
		behavior: Behavior,
		cursor: Cursor,
		scroller: Scroller,
		watcher: VideoWatcher | null,
		targets: PageTargets
	): Promise< void > {
		switch ( action ) {
			case 'advance':
				await this.drift( cursor );
				await scroller.burst( behavior.burstPx, this.animMs );
				log( `  advance → ${ Math.round( scroller.position ) }px` );
				// The pause after a move is the read — long for high Literacy.
				await delay( behavior.readingPauseMs, this.win );
				break;

			case 'regress':
				await this.drift( cursor );
				await scroller.burst( -behavior.burstPx, this.animMs );
				log( `  re-read → ${ Math.round( scroller.position ) }px` );
				await delay( behavior.readingPauseMs, this.win );
				break;

			case 'watch':
				await this.cursorToVideo( cursor, targets );
				cursor.click();
				this.watched = true;
				log( `  watch ${ Math.round( behavior.readingPauseMs ) }ms` );
				await delay( behavior.readingPauseMs, this.win );
				break;

			case 'replay':
				watcher?.replay();
				cursor.click();
				log( '  replay' );
				await delay( behavior.readingPauseMs, this.win );
				break;

			case 'dwell':
			default:
				await this.drift( cursor );
				log( `  read ${ Math.round( behavior.readingPauseMs ) }ms` );
				await delay( behavior.readingPauseMs, this.win );
				break;
		}
	}

	/**
	 * Drifts the cursor to a loose reading position in the viewport.
	 * @param cursor
	 */
	private drift( cursor: Cursor ): Promise< void > {
		return cursor.moveTo(
			this.win.innerWidth * ( 0.3 + Math.random() * 0.4 ),
			this.win.innerHeight * ( 0.3 + Math.random() * 0.3 ),
			this.animMs
		);
	}

	/**
	 * Moves the cursor onto the video player (its centre), or drifts if absent.
	 * @param cursor
	 * @param targets
	 */
	private cursorToVideo(
		cursor: Cursor,
		targets: PageTargets
	): Promise< void > {
		if ( ! targets.video ) {
			return this.drift( cursor );
		}

		const rect = targets.video.getBoundingClientRect();

		return cursor.moveTo(
			rect.left + rect.width / 2,
			rect.top + rect.height / 2,
			this.animMs
		);
	}
}
