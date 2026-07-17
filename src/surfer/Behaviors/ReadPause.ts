/**
 * A literacy-driven stop to actually read the page, rather than just
 * scrolling past it. Duration range is the article dwell profile from
 * `docs/knowledge-base/surf-behavior-profile.md` (reading pause, 8–20 s).
 * The whole pause is handed to `motor.read`, which works through the page's
 * prose passage by passage — scrolling to each one, pacing on its length,
 * sometimes tracking its lines with the cursor — so a long read looks like
 * reading, not like the page froze.
 */

import type { Behavior, BehaviorContext, BehaviorAnnounce } from '../Behavior';
import { LITERACY } from '../Behavior';
import type { Motor } from '../Motor';
import { drive, noise } from '../Bid';

const PAUSE_MS_MIN = 8000;
const PAUSE_MS_MAX = 20000;

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

	async run(
		motor: Motor,
		ctx: BehaviorContext,
		announce?: BehaviorAnnounce
	): Promise< void > {
		const ms = PAUSE_MS_MIN + ctx.rng() * ( PAUSE_MS_MAX - PAUSE_MS_MIN );
		announce?.( ms / ctx.speed );
		await motor.read( ms / ctx.speed );
	}
}
