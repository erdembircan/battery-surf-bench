/**
 * A fidgety jitter up or down — pure taste, no page support required. Like
 * `FidgetWiggle`, its pixel range is a small, hand-picked engine constant:
 * the knowledge-base's dwell tables cover macro page-browsing, not this kind
 * of idle micro-motion.
 */

import type { Behavior, BehaviorContext } from '@/surfer/Behavior';
import { FIDGET } from '@/surfer/Behavior';
import type { Motor } from '@/surfer/Motor';
import { drive, noise } from '@/surfer/Bid';

const JITTER_PX_MIN = 40;
const JITTER_PX_MAX = 80;
const JITTER_MS = 200;

export const MICRO_SCROLL_KEY = 'microScroll';

export class MicroScroll implements Behavior {
	readonly key = MICRO_SCROLL_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		return drive( ctx.traits[ FIDGET ] ?? 0 ) * appetite * noise( ctx.rng );
	}

	async run( motor: Motor, ctx: BehaviorContext ): Promise< void > {
		const magnitude =
			JITTER_PX_MIN + ctx.rng() * ( JITTER_PX_MAX - JITTER_PX_MIN );
		const px = ctx.rng() < 0.5 ? -magnitude : magnitude;
		await motor.scrollBy( px, JITTER_MS );
	}
}
