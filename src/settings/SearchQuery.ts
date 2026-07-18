/**
 * Queries the core `/wp/v2/search` endpoint for the Browse pane.
 *
 * The installed `@wordpress/core-data` (7.48) registers no `root`/`search`
 * entity, so `useEntityRecords` cannot reach this endpoint — it is queried
 * directly through `@wordpress/api-fetch`, reading the `X-WP-Total` /
 * `X-WP-TotalPages` headers ourselves the way core-data would.
 *
 * `/wp/v2/search` is the one core collection that already unifies multiple
 * post types behind a single, genuinely paginated, server-searched query
 * (`subtype=page,post`), which is exactly what the "All" tab needs — two
 * separate `postType` queries concatenated and sliced client-side silently
 * drop items past 10 total results and 400 once one type's page cursor runs
 * past its own last page (`rest_post_invalid_page_number`).
 */

import apiFetch from '@wordpress/api-fetch';
import { useEffect, useRef, useState } from '@wordpress/element';
import type { SearchRecord } from '@/settings/Types';

/** The args a Browse pane query is built from. */
export interface SearchQueryArgs {
	/** The free-text search term, or '' for no filter. */
	search: string;
	/** Comma-separated post type(s) to search: `'page,post'` for the "All" tab, or a single type. */
	subtype: string;
	/** 1-based page number. */
	page: number;
	/** Results per page. */
	perPage: number;
}

/** What a Browse pane query resolves to. */
export interface SearchQueryResult {
	records: SearchRecord[];
	totalItems: number;
	totalPages: number;
	isResolving: boolean;
	/** Whether the most recent request failed — surfaced, never swallowed, so the Browse pane can show an error instead of reading as "no results". */
	isError: boolean;
}

/**
 * A server-seeded first page — the PHP screen's own internal dispatch of the
 * exact same `/wp/v2/search` query the client's first fetch would run
 * ({@see \ErdemBircan\BatterySurfBench\Admin\SettingsScreen::initial_browse}).
 */
export interface SearchQuerySeed {
	records: SearchRecord[];
	totalItems: number;
	totalPages: number;
}

const EMPTY_RECORDS: SearchRecord[] = [];

/**
 * Reads a pagination-count header defensively: a missing or non-numeric value
 * (e.g. a header mangled by a proxy) falls back rather than poisoning the
 * pagination math with `NaN`.
 *
 * @param value    The raw header value, or null when absent.
 * @param fallback The count to use when the header is missing or not a finite, non-negative number.
 * @return The parsed count, or the fallback.
 */
function parseCountHeader( value: string | null, fallback: number ): number {
	const parsed = Number( value );
	return value !== null && Number.isFinite( parsed ) && parsed >= 0
		? parsed
		: fallback;
}

/**
 * Builds the `/wp/v2/search` request path for a Browse pane query.
 *
 * `type=post` scopes results to indexed content (posts and pages), excluding
 * the endpoint's other generic result kinds (e.g. taxonomy terms).
 *
 * @param args The query args.
 * @return The REST path, including its query string.
 */
export function searchPath( args: SearchQueryArgs ): string {
	const query = new URLSearchParams( {
		type: 'post',
		subtype: args.subtype,
		search: args.search,
		page: String( args.page ),
		per_page: String( args.perPage ),
		_fields: 'id,title,url,subtype',
	} );

	return `/wp/v2/search?${ query.toString() }`;
}

/**
 * Resolves a Browse pane query against `/wp/v2/search`, re-querying whenever
 * the args change. Every request is a single, bounded (`per_page`) page —
 * never a fetch-everything-then-slice — with the totals read straight from
 * the response headers.
 *
 * When a `seed` is given, the very first render skips the mount-time fetch
 * entirely and paints straight from it instead — the caller is responsible
 * for only passing a `seed` when `args` actually describes the default query
 * that seed was fetched for (the PHP side always seeds the same default:
 * empty search, every selectable subtype, page 1). Every later args change,
 * including one that happens to land back on that same default, re-fetches
 * normally: the seed is a mount-only shortcut, not a cache.
 *
 * @param args The current query args.
 * @param seed A server-fetched first page to paint from on mount instead of fetching, or undefined to always fetch.
 * @return The resolved records and pagination totals.
 */
export function useSearchResults(
	args: SearchQueryArgs,
	seed?: SearchQuerySeed
): SearchQueryResult {
	// Only the very first effect run may consume the seed; every later run —
	// even one that lands back on the same args — fetches for real.
	const seedable = useRef( seed !== undefined );

	const [ result, setResult ] = useState< SearchQueryResult >( () =>
		seed !== undefined
			? {
					records: seed.records,
					totalItems: seed.totalItems,
					totalPages: seed.totalPages,
					isResolving: false,
					isError: false,
			  }
			: {
					records: EMPTY_RECORDS,
					totalItems: 0,
					totalPages: 1,
					isResolving: true,
					isError: false,
			  }
	);

	useEffect( () => {
		if ( seedable.current ) {
			seedable.current = false;
			return;
		}

		let cancelled = false;
		// Clear a stale error from a previous request as soon as a new one
		// starts — the spinner is the one busy indicator; an old error
		// shouldn't linger alongside it while a fresh page/search is in flight.
		setResult( ( previous ) => ( {
			...previous,
			isResolving: true,
			isError: false,
		} ) );

		apiFetch< Response, false >( {
			path: searchPath( args ),
			parse: false,
		} )
			.then( async ( response ) => {
				if ( cancelled ) {
					return;
				}
				const records = ( await response.json() ) as SearchRecord[];
				setResult( {
					records,
					totalItems: parseCountHeader(
						response.headers.get( 'X-WP-Total' ),
						records.length
					),
					totalPages: parseCountHeader(
						response.headers.get( 'X-WP-TotalPages' ),
						1
					),
					isResolving: false,
					isError: false,
				} );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				// Surfaced, not swallowed: the Browse pane renders an error Notice
				// for this rather than reading the emptied records as "no matches".
				setResult( {
					records: EMPTY_RECORDS,
					totalItems: 0,
					totalPages: 1,
					isResolving: false,
					isError: true,
				} );
			} );

		return () => {
			cancelled = true;
		};
		// `args` is a plain object rebuilt every render; its fields are the real
		// dependencies.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ args.search, args.subtype, args.page, args.perPage ] );

	return result;
}
