/**
 * Surf engine entry — the classic script the course router enqueues on every
 * course page. Boots the engine only when the traits URL param is present, so
 * opening a course page directly (outside a cockpit run) shows a normal,
 * static page with no scripted behavior.
 */

import { normalizeTraits } from '../shared/SurferStats';
import { normalizeSpeed } from '../cockpit/RunConfig';
import { mulberry32 } from './Rng';
import { RealClock } from './Clock';
import { senseAffordances } from './Affordances';
import { DomMotor } from './Motor';
import { SurfLoop } from './SurfLoop';
import { whenDocumentLoaded } from './PageLoad';
import { ScrollBurst } from './Behaviors/ScrollBurst';
import { ReadPause } from './Behaviors/ReadPause';
import { GlanceBack } from './Behaviors/GlanceBack';
import { WatchVideo } from './Behaviors/WatchVideo';
import { LingerImage } from './Behaviors/LingerImage';
import { FidgetWiggle } from './Behaviors/FidgetWiggle';
import { MicroScroll } from './Behaviors/MicroScroll';
import { SelectSnippet } from './Behaviors/SelectSnippet';
import { MoveOn } from './Behaviors/MoveOn';

/** URL param carrying the comma-separated trait vector; its presence boots the engine. */
const TRAITS_PARAM = 'bsbTraits';

/** URL param carrying the demo speed multiplier. */
const SPEED_PARAM = 'bsbSpeed';

/** Posted to the parent frame when the page's surf session ends. */
const PAGE_DONE_MESSAGE = { type: 'bsb:pageDone' } as const;

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

	const loop = new SurfLoop( {
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
		onPageDone: () => {
			window.parent.postMessage(
				PAGE_DONE_MESSAGE,
				window.location.origin
			);
		},
	} );

	whenDocumentLoaded( window, () => loop.start() );
}
