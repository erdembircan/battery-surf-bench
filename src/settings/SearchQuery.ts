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
import { useEffect, useState } from '@wordpress/element';
import type { SearchRecord } from './Types';

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
}

const EMPTY_RECORDS: SearchRecord[] = [];

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
 * @param args The current query args.
 * @return The resolved records and pagination totals.
 */
export function useSearchResults( args: SearchQueryArgs ): SearchQueryResult {
	const [ result, setResult ] = useState< SearchQueryResult >( {
		records: EMPTY_RECORDS,
		totalItems: 0,
		totalPages: 1,
		isResolving: true,
	} );

	useEffect( () => {
		let cancelled = false;
		setResult( ( previous ) => ( { ...previous, isResolving: true } ) );

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
					totalItems: Number(
						response.headers.get( 'X-WP-Total' ) ?? records.length
					),
					totalPages: Number(
						response.headers.get( 'X-WP-TotalPages' ) ?? 1
					),
					isResolving: false,
				} );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				setResult( {
					records: EMPTY_RECORDS,
					totalItems: 0,
					totalPages: 1,
					isResolving: false,
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
