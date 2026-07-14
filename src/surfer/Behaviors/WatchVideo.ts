/**
 * Sits and watches when a page offers a video or a recognized video-host
 * embed (YouTube, Vimeo). A page with neither zeroes this behavior's bid via
 * `hasVideo` rather than a branch. Duration is deliberately half the
 * video-page dwell profile from
 * `docs/knowledge-base/surf-behavior-profile.md` (60–90 s) — a full minute
 * parked on a video reads as too long in the cockpit, per maintainer
 * preference.
 *
 * `run()` is genuinely player-state-aware rather than blindly dwelling a
 * fixed duration next to whatever the embed happens to be doing: it starts
 * playback (`motor.playVideo()`), then dwells the watch window in small
 * slices, checking `motor.videoState()` after each one. The single signal
 * that matters is `'ended'` — reacting to it (not to duration/currentTime
 * numbers, which `Motor`/`VideoControl` deliberately never expose) covers
 * both length-mismatch directions in one rule:
 * - the video is SHORTER than the watch window → it reports `'ended'` before
 *   the window elapses, and `motor.replayVideo()` restarts it so the surfer
 *   keeps watching (rather than sitting next to a finished player) until the
 *   window really is up;
 * - the video is LONGER than the window (or the target has no readable state
 *   at all, e.g. Vimeo, or there was no video to attend in the first place)
 *   → it never reports `'ended'`, so the loop just dwells the full window
 *   with no replay.
 *
 * A full `motor.stopVideo()` always closes out the window (never a mere
 * pause), so the next `watchVideo` win starts clean rather than resuming a
 * paused player.
 */

import type { Behavior, BehaviorContext } from '../Behavior';
import { ALLURE } from '../Behavior';
import type { Motor } from '../Motor';
import { drive, noise } from '../Bid';

const WATCH_MS_MIN = 30000;
const WATCH_MS_MAX = 45000;

/**
 * How often the dwell loop re-checks the player's state for `'ended'`, in
 * ms. Small enough that a video ending mid-window is noticed and replayed
 * promptly (no long dead gap staring at a finished player), large enough
 * not to turn the dwell into a busy-poll.
 */
const STATE_CHECK_SLICE_MS = 750;

export const WATCH_VIDEO_KEY = 'watchVideo';

export class WatchVideo implements Behavior {
	readonly key = WATCH_VIDEO_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		return (
			drive( ctx.traits[ ALLURE ] ?? 0 ) *
			( ctx.affordances.hasVideo ? 1 : 0 ) *
			appetite *
			noise( ctx.rng )
		);
	}

	async run( motor: Motor, ctx: BehaviorContext ): Promise< void > {
		await motor.playVideo();

		let remaining =
			( WATCH_MS_MIN + ctx.rng() * ( WATCH_MS_MAX - WATCH_MS_MIN ) ) /
			ctx.speed;

		while ( remaining > 0 ) {
			const slice = Math.min( STATE_CHECK_SLICE_MS, remaining );
			await motor.idle( slice );
			remaining -= slice;

			if ( remaining > 0 && 'ended' === motor.videoState() ) {
				await motor.replayVideo();
			}
		}

		await motor.stopVideo();
	}
}
