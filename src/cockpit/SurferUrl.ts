/**
 * Carries the surfer's trait vector and demo speed onto the viewport iframe's
 * URL, so the surf engine running inside it can read them off `location.search`
 * without any other channel between the cockpit and the iframe.
 */

import { normalizeTraits } from '../shared/SurferStats';
import { normalizeSpeed } from './RunConfig';

/** URL param carrying the comma-separated trait vector. */
export const TRAITS_PARAM = 'bsbTraits';

/** URL param carrying the demo speed multiplier. */
export const SPEED_PARAM = 'bsbSpeed';

/**
 * Appends the normalized traits and speed to a course page URL as query
 * params. Both values are normalized here (not just on the engine side) so a
 * tampered context cannot smuggle an out-of-range vector onto the URL either.
 * @param url
 * @param traits
 * @param speed
 */
export const withSurferParams = (
	url: string,
	traits: readonly number[],
	speed: number
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

	return withParams.toString();
};
