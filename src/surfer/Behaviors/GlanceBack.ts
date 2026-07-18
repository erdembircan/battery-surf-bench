/**
 * A brief re-read: scroll back up, then settle. Absorbs the old `recall`
 * stat into literacy — the more of the page already read, the more there is
 * to glance back at, so its affordance grows as `scrollRemaining` shrinks.
 * The settle pause reuses the 1–3 s settle-beat convention from
 * `docs/knowledge-base/surf-behavior-profile.md`.
 */

import type {
	Behavior,
	BehaviorContext,
	BehaviorAnnounce,
} from '@/surfer/Behavior';
import { LITERACY } from '@/surfer/Behavior';
import type { Motor } from '@/surfer/Motor';
import { drive, noise, clamp01 } from '@/surfer/Bid';

const SCROLL_UP_PX_MIN = 500;
const SCROLL_UP_PX_MAX = 700;
const SCROLL_UP_MS = 300;
const SETTLE_MS_MIN = 1000;
const SETTLE_MS_MAX = 3000;

export const GLANCE_BACK_KEY = 'glanceBack';

export class GlanceBack implements Behavior {
	readonly key = GLANCE_BACK_KEY;

	bid( ctx: BehaviorContext, appetite: number ): number {
		const affordance = clamp01( 1 - ctx.affordances.scrollRemaining );

		return (
			drive( ctx.traits[ LITERACY ] ?? 0 ) *
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
		const px =
			SCROLL_UP_PX_MIN +
			ctx.rng() * ( SCROLL_UP_PX_MAX - SCROLL_UP_PX_MIN );

		const settleMs =
			SETTLE_MS_MIN + ctx.rng() * ( SETTLE_MS_MAX - SETTLE_MS_MIN );

		// Both samples happen first (rng order unaffected — the scroll await
		// below consumes no rng), so the announced total — the fixed scroll
		// leg plus the speed-scaled settle — is known before either await.
		announce?.( SCROLL_UP_MS + settleMs / ctx.speed );

		await motor.scrollBy( -px, SCROLL_UP_MS );
		await motor.idle( settleMs / ctx.speed );
	}
}
