/**
 * Carries the surfer's trait vector, demo speed and sterile flag onto the
 * viewport iframe's URL, so the surf engine running inside it can read them
 * off `location.search` without any other channel between the cockpit and
 * the iframe.
 */

import { normalizeTraits } from '@/shared/SurferStats';
import { normalizeSpeed } from '@/cockpit/RunConfig';

/** URL param carrying the comma-separated trait vector. */
export const TRAITS_PARAM = 'bsbTraits';

/** URL param carrying the demo speed multiplier. */
export const SPEED_PARAM = 'bsbSpeed';

/**
 * URL param whose presence (`1`) tells `EngineBoot` to boot a `SterileHelm`
 * instead of the auction-driven `SurfLoop`. Only ever appended, never set to
 * `0` — its plain absence is what a natural run's URL carries.
 */
export const STERILE_PARAM = 'bsbSterile';

/**
 * Appends the normalized traits, speed and (when armed) the sterile flag to a
 * course page URL as query params. Traits and speed are normalized here (not
 * just on the engine side) so a tampered context cannot smuggle an
 * out-of-range vector onto the URL either.
 * @param url
 * @param traits
 * @param speed
 * @param sterile Whether the live run is sterile; appends `bsbSterile=1` when true, omits the param entirely otherwise.
 */
export const withSurferParams = (
	url: string,
	traits: readonly number[],
	speed: number,
	sterile = false
): string => {
	const withParams = new URL( url );
	withParams.searchParams.set(
		TRAITS_PARAM,
		normalizeTraits( traits ).join( ',' )
	);
	withParams.searchParams.set(
		SPEED_PARAM,
		String( normalizeSpeed( speed ) )
	);

	if ( BSB_DEV_TOOLS && sterile ) {
		withParams.searchParams.set( STERILE_PARAM, '1' );
	}

	return withParams.toString();
};
