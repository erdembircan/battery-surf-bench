/**
 * The baseline mover. Every other behavior is trait-driven; this one carries
 * a modest, trait-independent drive so a page always makes some scroll
 * progress even when every stat sits at zero, scaled down by how little
 * scrollable content remains — quiet once there is nothing left below.
 */

import type { Behavior, BehaviorContext } from '../Behavior';
import { TEMPO } from '../Behavior';
import type { Motor } from '../Motor';
import { noise } from '../Bid';
import { flickPx, flickEaseMs } from '../Tempo';

/** Constant drive, independent of any trait — this is the "always surfs" baseline. */
const BASELINE_DRIVE = 0.5;

export const SCROLL_BURST_KEY = 'scrollBurst';

export class ScrollBurst implements Behavior {
	readonly key = SCROLL_BURST_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		return (
			BASELINE_DRIVE *
			ctx.affordances.scrollRemaining *
			appetite *
			noise( ctx.rng )
		);
	}

	async run( motor: Motor, ctx: BehaviorContext ): Promise< void > {
		const tempo = ctx.traits[ TEMPO ] ?? 0;
		await motor.scrollBy( flickPx( tempo ), flickEaseMs( tempo ) );
	}
}
