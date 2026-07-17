/**
 * Idle text selection — a fidget tic, not a reading action, so fidget is the
 * governing stat; `textDensity` gates it multiplicatively since there must
 * be text on the page to select in the first place.
 */

import type { Behavior, BehaviorContext, BehaviorAnnounce } from '../Behavior';
import { FIDGET } from '../Behavior';
import type { Motor } from '../Motor';
import { drive, noise } from '../Bid';

export const SELECT_SNIPPET_KEY = 'selectSnippet';

/**
 * Mirrors the motor's fixed selection choreography: the approach, sweep and
 * hold durations `Motor`'s `selectSnippet()` uses internally, none of them
 * speed-scaled.
 */
export const SELECT_SNIPPET_DISPLAY_MS = 1800;

export class SelectSnippet implements Behavior {
	readonly key = SELECT_SNIPPET_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		return (
			drive( ctx.traits[ FIDGET ] ?? 0 ) *
			ctx.affordances.textDensity *
			appetite *
			noise( ctx.rng )
		);
	}

	async run(
		motor: Motor,
		_ctx: BehaviorContext,
		announce?: BehaviorAnnounce
	): Promise< void > {
		announce?.( SELECT_SNIPPET_DISPLAY_MS );
		await motor.selectSnippet();
	}
}
