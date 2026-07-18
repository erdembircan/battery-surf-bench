/**
 * Surf engine entry — the classic script the course router enqueues on every
 * course page. Boots the engine only when the traits URL param is present, so
 * opening a course page directly (outside a cockpit run) shows a normal,
 * static page with no scripted behavior.
 */

import { normalizeTraits } from '@/shared/SurferStats';
import { normalizeSpeed } from '@/cockpit/RunConfig';
import { mulberry32 } from '@/surfer/Rng';
import { RealClock } from '@/surfer/Clock';
import { senseAffordances } from '@/surfer/Affordances';
import { DomMotor } from '@/surfer/Motor';
import { SurfLoop } from '@/surfer/SurfLoop';
import { SterileHelm } from '@/surfer/SterileHelm';
import { whenDocumentLoaded } from '@/surfer/PageLoad';
import { ScrollBurst } from '@/surfer/Behaviors/ScrollBurst';
import { ReadPause } from '@/surfer/Behaviors/ReadPause';
import { GlanceBack } from '@/surfer/Behaviors/GlanceBack';
import { WatchVideo } from '@/surfer/Behaviors/WatchVideo';
import { LingerImage } from '@/surfer/Behaviors/LingerImage';
import { FidgetWiggle } from '@/surfer/Behaviors/FidgetWiggle';
import { MicroScroll } from '@/surfer/Behaviors/MicroScroll';
import { SelectSnippet } from '@/surfer/Behaviors/SelectSnippet';
import { MoveOn } from '@/surfer/Behaviors/MoveOn';

/** URL param carrying the comma-separated trait vector; its presence boots the engine. */
const TRAITS_PARAM = 'bsbTraits';

/** URL param carrying the demo speed multiplier. */
const SPEED_PARAM = 'bsbSpeed';

/**
 * URL param whose presence (`1`) boots a `SterileHelm` instead of the
 * auction-driven `SurfLoop`: the dev-tools "Sterile" override, seeded by
 * `RunStore.currentSrc` only while a run's `context.sterile` is armed.
 */
const STERILE_PARAM = 'bsbSterile';

/** Posted to the parent frame when the page's surf session ends. */
const PAGE_DONE_MESSAGE = { type: 'bsb:pageDone' } as const;

/**
 * The message type posted to the parent frame when a behavior starts running.
 * The cockpit-side receiver ({@see src/cockpit/BehaviorStart.ts}) owns its own
 * copy of this literal — the engine bundle and the cockpit module share no
 * imports across the frame boundary, exactly as `bsb:pageDone` does today.
 */
const BEHAVIOR_START_TYPE = 'bsb:behaviorStart';

/**
 * The message type `SterileHelm` posts once a steered behavior's `run()`
 * resolves. The cockpit-side receiver ({@see src/cockpit/BehaviorEnd.ts})
 * owns its own copy of this literal, for the same reason as
 * `BEHAVIOR_START_TYPE` above.
 */
const BEHAVIOR_END_TYPE = 'bsb:behaviorEnd';

/**
 * The message type `SterileHelm` posts once, at readiness, with the sterile
 * page's affordance flags. The dev-tools panel's own receiver
 * ({@see src/cockpit/PageAffordances.ts}) owns its own copy of this literal,
 * for the same reason as `BEHAVIOR_START_TYPE` above.
 */
const PAGE_AFFORDANCES_TYPE = 'bsb:pageAffordances';

/** A fresh, unpredictable seed for the engine's one PRNG instance. */
const randomSeed = (): number => {
	if (
		typeof crypto !== 'undefined' &&
		typeof crypto.getRandomValues === 'function'
	) {
		return crypto.getRandomValues( new Uint32Array( 1 ) )[ 0 ];
	}

	return Math.floor( performance.now() * 1000 ) % 4294967296;
};

const params = new URLSearchParams( window.location.search );

if ( params.has( TRAITS_PARAM ) ) {
	const traits = normalizeTraits(
		params.get( TRAITS_PARAM )?.split( ',' ).map( Number )
	);
	const speed = normalizeSpeed( Number( params.get( SPEED_PARAM ) ) );
	const rng = mulberry32( randomSeed() );
	const sterile = params.get( STERILE_PARAM ) === '1';

	const onPageDone = (): void => {
		window.parent.postMessage( PAGE_DONE_MESSAGE, window.location.origin );
	};
	const onBehaviorRun = ( key: string, durationMs?: number ): void => {
		window.parent.postMessage(
			{ type: BEHAVIOR_START_TYPE, key, durationMs },
			window.location.origin
		);
	};

	const sharedDeps = {
		behaviors: [
			new ScrollBurst(),
			new ReadPause(),
			new GlanceBack(),
			new WatchVideo(),
			new LingerImage(),
			new FidgetWiggle(),
			new MicroScroll(),
			new SelectSnippet(),
			new MoveOn(),
		],
		motor: new DomMotor( rng ),
		clock: new RealClock(),
		rng,
		traits,
		senseAffordances: () => senseAffordances( document ),
		speed,
	};

	if ( sterile ) {
		// The auction never ticks: each behavior is instead fired manually from
		// the dev-tools panel, and run exactly once over this same motor and
		// context-sensing path.
		const helm = new SterileHelm( {
			...sharedDeps,
			onPageDone,
			onBehaviorRun,
			onBehaviorEnd: ( key ) => {
				window.parent.postMessage(
					{ type: BEHAVIOR_END_TYPE, key },
					window.location.origin
				);
			},
			onPageAffordances: ( affordances ) => {
				window.parent.postMessage(
					{
						type: PAGE_AFFORDANCES_TYPE,
						affordances: {
							hasVideo: affordances.hasVideo,
							imageCount: affordances.imageCount,
							textDensity: affordances.textDensity,
						},
					},
					window.location.origin
				);
			},
		} );

		whenDocumentLoaded( window, () => helm.start() );
	} else {
		const loop = new SurfLoop( {
			...sharedDeps,
			onPageDone,
			onBehaviorRun,
		} );

		whenDocumentLoaded( window, () => loop.start() );
	}
}
