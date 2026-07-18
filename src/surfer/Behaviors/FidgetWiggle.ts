/**
 * An aimless cursor wander — pure taste, no page support required, so its
 * affordance is a constant 1. Fidget's micro-motion has no published dwell
 * profile (the knowledge-base only covers macro page-browsing behavior), so
 * this range is a small, hand-picked engine constant rather than a
 * research-derived one.
 */

import type { Behavior, BehaviorContext } from '@/surfer/Behavior';
import { FIDGET } from '@/surfer/Behavior';
import type { Motor } from '@/surfer/Motor';
import { drive, noise } from '@/surfer/Bid';

const WIGGLE_MS_MIN = 500;
const WIGGLE_MS_MAX = 1500;

export const FIDGET_WIGGLE_KEY = 'fidgetWiggle';

export class FidgetWiggle implements Behavior {
	readonly key = FIDGET_WIGGLE_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		return drive( ctx.traits[ FIDGET ] ?? 0 ) * appetite * noise( ctx.rng );
	}

	async run( motor: Motor, ctx: BehaviorContext ): Promise< void > {
		const ms =
			WIGGLE_MS_MIN + ctx.rng() * ( WIGGLE_MS_MAX - WIGGLE_MS_MIN );
		await motor.pointerDrift( ms / ctx.speed );
	}
}
