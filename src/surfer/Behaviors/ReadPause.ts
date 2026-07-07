/**
 * A literacy-driven stop to actually read the page, rather than just
 * scrolling past it. Duration range is the article dwell profile from
 * `docs/knowledge-base/surf-behavior-profile.md` (reading pause, 8–20 s). A
 * fraction of reads have the cursor follow the text like a reader tracking
 * lines (`motor.readTrace`); the rest hold still (`motor.idle`) as before —
 * the choice is a per-win rng draw, never gated on page state.
 */

import type { Behavior, BehaviorContext } from '../Behavior';
import { LITERACY } from '../Behavior';
import type { Motor } from '../Motor';
import { drive, noise } from '../Bid';

const PAUSE_MS_MIN = 8000;
const PAUSE_MS_MAX = 20000;

/** Fraction of reads where the pointer follows the text along with the eyes. */
const TRACE_CHANCE = 0.35;

export const READ_PAUSE_KEY = 'readPause';

export class ReadPause implements Behavior {
	readonly key = READ_PAUSE_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		return (
			drive( ctx.traits[ LITERACY ] ?? 0 ) *
			ctx.affordances.textDensity *
			appetite *
			noise( ctx.rng )
		);
	}

	async run( motor: Motor, ctx: BehaviorContext ): Promise< void > {
		const ms = PAUSE_MS_MIN + ctx.rng() * ( PAUSE_MS_MAX - PAUSE_MS_MIN );

		if ( ctx.rng() < TRACE_CHANCE ) {
			await motor.readTrace( ms / ctx.speed );
			return;
		}

		await motor.idle( ms / ctx.speed );
	}
}
