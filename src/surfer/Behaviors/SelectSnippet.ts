/**
 * Idle text selection — a fidget tic, not a reading action, so fidget is the
 * governing stat; `textDensity` gates it multiplicatively since there must
 * be text on the page to select in the first place.
 */

import type { Behavior, BehaviorContext } from '../Behavior';
import { FIDGET } from '../Behavior';
import type { Motor } from '../Motor';
import { drive, noise } from '../Bid';

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

	async run( motor: Motor ): Promise< void > {
		await motor.selectSnippet();
	}
}
