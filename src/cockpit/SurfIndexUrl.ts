/**
 * Builds the index-based surf URL the viewport iframe loads: an opaque,
 * client-incrementing page index and a `bsbench_surf` nonce proving the request
 * came from the authorized cockpit. The client holds nothing else about the
 * pages it surfs — no ids, URLs, titles, order, or count — that is resolved
 * entirely server-side by `CourseRouter`, which wraps the index against the
 * saved course order's length so the counter can climb forever without the
 * client ever learning how many pages exist.
 */

/** Query param carrying the opaque, client-incrementing page index. */
export const SURF_INDEX_PARAM = 'bsbenchSurfIndex';

/** Query param carrying the `bsbench_surf` nonce authorizing an index request. */
export const SURF_NONCE_PARAM = 'bsbenchNonce';

/**
 * Builds the base surf URL for a given page index: the site's home URL
 * (seeded server-side) with the index and nonce query params appended. The
 * caller layers the surfer's trait/speed params on top with
 * {@link ./SurferUrl!withSurferParams}.
 *
 * @param base  The site's home URL, seeded server-side via `getConfig()`.
 * @param index The opaque page index to request.
 * @param nonce The `bsbench_surf` nonce, seeded server-side via `getConfig()`.
 * @return The base surf URL, or '' when the base or nonce was not seeded.
 */
export const buildSurfIndexUrl = (
	base: string,
	index: number,
	nonce: string
): string => {
	if ( ! base || ! nonce ) {
		return '';
	}

	const url = new URL( base );
	url.searchParams.set( SURF_INDEX_PARAM, String( index ) );
	url.searchParams.set( SURF_NONCE_PARAM, nonce );

	return url.toString();
};
