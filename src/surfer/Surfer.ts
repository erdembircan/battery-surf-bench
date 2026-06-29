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

			if ( Math.random() < behavior.readingPauseChance ) {
				await delay( behavior.readingPauseMs, this.win );

				if ( Math.random() < behavior.scrollUpChance ) {
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
		await delay( watchMs, this.win );

		if ( Math.random() < behavior.videoReplayChance ) {
			watcher.replay();
			cursor.click();
			await delay( ( deadline - performance.now() ) * 0.5, this.win );
		}
	}
}
