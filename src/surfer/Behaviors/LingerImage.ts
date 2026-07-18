/**
 * Attends a real content image — scrolling it into view, travelling the
 * cursor onto it, and dwelling there — allure's other outlet besides video.
 * Affordance saturates once a handful of images are present, so a single
 * hero image and a full gallery both count as "has imagery" without needing
 * an exact threshold. Duration reuses the gallery reading-pause range from
 * `docs/knowledge-base/surf-behavior-profile.md` (1.5–4 s).
 */

import type {
	Behavior,
	BehaviorContext,
	BehaviorAnnounce,
} from '@/surfer/Behavior';
import { ALLURE } from '@/surfer/Behavior';
import type { Motor } from '@/surfer/Motor';
import { drive, noise, clamp01 } from '@/surfer/Bid';

/** Image count at which the affordance saturates to 1. */
const IMAGE_SATURATION = 4;

const LINGER_MS_MIN = 1500;
const LINGER_MS_MAX = 4000;

export const LINGER_IMAGE_KEY = 'lingerImage';

export class LingerImage implements Behavior {
	readonly key = LINGER_IMAGE_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		const affordance = clamp01(
			ctx.affordances.imageCount / IMAGE_SATURATION
		);

		return (
			drive( ctx.traits[ ALLURE ] ?? 0 ) *
			affordance *
			appetite *
			noise( ctx.rng )
		);
	}

	async run(
		motor: Motor,
		ctx: BehaviorContext,
		announce?: BehaviorAnnounce
	): Promise< void > {
		const ms =
			LINGER_MS_MIN + ctx.rng() * ( LINGER_MS_MAX - LINGER_MS_MIN );
		announce?.( ms / ctx.speed );
		await motor.lingerImage( ms / ctx.speed );
	}
}
