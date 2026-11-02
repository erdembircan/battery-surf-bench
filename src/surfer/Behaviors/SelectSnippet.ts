/**
 * Idle text selection — a fidget tic, not a reading action, so fidget is the
 * governing stat; `textDensity` gates it multiplicatively since there must
 * be text on the page to select in the first place. How long it holds the
 * stage depends on the snippet the motor picks (the sweep is paced per
 * character), so the behavior hands its announce to the motor rather than
 * announcing a fixed duration of its own.
 */

import type {
	Behavior,
	BehaviorContext,
	BehaviorAnnounce,
} from '@/surfer/Behavior';
import { FIDGET } from '@/surfer/Behavior';
import type { Motor } from '@/surfer/Motor';
import { drive, noise } from '@/surfer/Bid';

export const SELECT_SNIPPET_KEY = 'selectSnippet';

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
		await motor.selectSnippet( announce );
	}
}
