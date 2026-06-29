/**
 * The surf engine's orchestrator: it turns one course page into a human-looking
 * visit shaped by the trait vector. It derives the behaviour for the page,
 * drives the cursor and scroller (reading bursts, pauses, re-read scroll-ups, or
 * watching and replaying the video), idles out the remaining dwell, then tells
 * the cockpit the page is done so the next one loads.
 *
 * It is a deadline-budget scheduler, not a fixed loop: a dwell deadline bounds
 * the visit and each step checks it. Durations come pre-scaled by the demo speed
 * from {@link ./Behavior}; the eased burst/glide duration is scaled here too, so
 * the whole visit fast-forwards together.
 */

import { type RunParams } from './RunParams';
import { findTargets } from './PageModel';
import { behaviorFor, type Behavior } from './Behavior';
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
		const deadline = performance.now() + behavior.dwellMs;

		log(
			`▶ ${ this.params.slug } (${
				targets.type
			}) · traits=[${ this.params.traits.join( ',' ) }] · speed=${
				this.params.speed
			}×`
		);
		log(
			`  behaviour: dwell=${ Math.round(
				behavior.dwellMs
			) }ms depth=${ behavior.scrollDepth.toFixed( 2 ) } burst=${
				behavior.burstPx
			}px gap=${ Math.round(
				behavior.burstGapMs
			) }ms readPause=${ behavior.readingPauseChance.toFixed(
				2
			) } scrollUp=${ behavior.scrollUpChance.toFixed( 2 ) }`
		);

		try {
			if ( targets.type === 'video' && targets.video ) {
				await this.watchVideo(
					targets.video,
					behavior,
					cursor,
					scroller,
					deadline
				);
			} else {
				await this.readPage( behavior, cursor, scroller, deadline );
			}

			const remaining = deadline - performance.now();
			if ( remaining > 0 ) {
				await delay( remaining, this.win );
			}
		} finally {
			log( `■ ${ this.params.slug } done → advancing queue` );
			cursor.destroy();
			pageDone( this.win );
		}
	}

	/**
	 * A reading visit: settle, then burst-scroll toward the target depth, pausing
	 * to read (and occasionally scrolling back up to re-read) as the stats decide,
	 * the cursor drifting over the text.
	 * @param behavior
	 * @param cursor
	 * @param scroller
	 * @param deadline
	 */
	private async readPage(
		behavior: Behavior,
		cursor: Cursor,
		scroller: Scroller,
		deadline: number
	): Promise< void > {
		const targetScroll = scroller.maxScroll * behavior.scrollDepth;

		log(
			`  reading: settling, target depth ${ Math.round(
				targetScroll
			) }px`
		);
		await delay( behavior.burstGapMs, this.win );

		while (
			performance.now() < deadline &&
			scroller.position < targetScroll
		) {
			await cursor.moveTo(
				this.win.innerWidth * ( 0.3 + Math.random() * 0.4 ),
				this.win.innerHeight * ( 0.3 + Math.random() * 0.3 ),
				this.animMs
			);
			await scroller.burst( behavior.burstPx, this.animMs );
			log( `  scroll burst → ${ Math.round( scroller.position ) }px` );

			if ( Math.random() < behavior.readingPauseChance ) {
				log(
					`  reading pause ${ Math.round(
						behavior.readingPauseMs
					) }ms`
				);
				await delay( behavior.readingPauseMs, this.win );

				if ( Math.random() < behavior.scrollUpChance ) {
					log( '  re-read scroll-up' );
					await scroller.burst(
						-behavior.burstPx * 0.5,
						this.animMs
					);
				}
			} else {
				await delay( behavior.burstGapMs, this.win );
			}
		}
	}

	/**
	 * A video visit: settle below the player, move the cursor onto it, watch the
	 * trait-decided fraction of the dwell, and maybe replay it.
	 * @param video
	 * @param behavior
	 * @param cursor
	 * @param scroller
	 * @param deadline
	 */
	private async watchVideo(
		video: HTMLIFrameElement,
		behavior: Behavior,
		cursor: Cursor,
		scroller: Scroller,
		deadline: number
	): Promise< void > {
		await scroller.burst( behavior.burstPx * 0.3, this.animMs );

		const rect = video.getBoundingClientRect();
		await cursor.moveTo(
			rect.left + rect.width / 2,
			rect.top + rect.height / 2,
			this.animMs
		);
		cursor.click();

		const watcher = new VideoWatcher( video );
		const watchMs =
			( deadline - performance.now() ) * behavior.videoWatchFraction;
		log(
			`  watching video ${ Math.round(
				watchMs
			) }ms (fraction ${ behavior.videoWatchFraction.toFixed( 2 ) })`
		);
		await delay( watchMs, this.win );

		if ( Math.random() < behavior.videoReplayChance ) {
			log( '  replay video' );
			watcher.replay();
			cursor.click();
			await delay( ( deadline - performance.now() ) * 0.5, this.win );
		}
	}
}
