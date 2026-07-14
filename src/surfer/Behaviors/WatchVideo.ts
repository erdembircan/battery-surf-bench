/**
 * Sits and watches when a page offers a video or a recognized video-host
 * embed (YouTube, Vimeo). A page with neither zeroes this behavior's bid via
 * `hasVideo` rather than a branch. Duration is deliberately half the
 * video-page dwell profile from
 * `docs/knowledge-base/surf-behavior-profile.md` (60–90 s) — a full minute
 * parked on a video reads as too long in the cockpit, per maintainer
 * preference.
 *
 * `run()` itself is a plain start → dwell → stop — it is `motor.playVideo()`
 * that makes the dwell genuinely player-state-aware, not a loop in here:
 * while the started control stays active, it auto-replays itself the
 * instant the player's own event stream reports `ended` (see `VideoControl`
 * and `DomMotor.playVideo`'s `onEnded` subscription) — no polling, no timer
 * slices, just reacting to the real event. A video SHORTER than the watch
 * window therefore ends and is seamlessly rewatched, keeping the surfer
 * watching until the window really is up; a video LONGER than the window
 * (or a target with no readable end event at all, e.g. Vimeo) simply never
 * ends before the dwell is over and is cut off by the closing
 * `motor.stopVideo()`.
 *
 * A full `motor.stopVideo()` always closes out the window (never a mere
 * pause) and unsubscribes the auto-replay first, so no replay can fire after
 * the window ends and the next `watchVideo` win starts clean rather than
 * resuming a paused player.
 */

import type { Behavior, BehaviorContext } from '../Behavior';
import { ALLURE } from '../Behavior';
import type { Motor } from '../Motor';
import { drive, noise } from '../Bid';

const WATCH_MS_MIN = 30000;
const WATCH_MS_MAX = 45000;

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
		const ms = WATCH_MS_MIN + ctx.rng() * ( WATCH_MS_MAX - WATCH_MS_MIN );
		await motor.idle( ms / ctx.speed );
		await motor.stopVideo();
	}
}
