/**
 * Sits and watches when a page offers a video or a recognized video-host
 * embed (YouTube, Vimeo). A page with neither zeroes this behavior's bid via
 * `hasVideo` rather than a branch. Replay emerges for free: winning this
 * behavior again later just plays again. Duration is deliberately half the
 * video-page dwell profile from `docs/knowledge-base/surf-behavior-profile.md`
 * (60–90 s) — a full minute parked on a video reads as too long in the
 * cockpit, per maintainer preference.
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
	}
}
