/**
 * Resolves titles and post types for the saved order's user pages.
 *
 * The saved order only carries post ids, so their titles and post types are
 * fetched separately. A site can have well over 100 selected user pages, and
 * the REST `include` parameter is capped at 100 like every other collection
 * query, so ids are split into chunks of at most 100 and each chunk is
 * queried per selectable post type (a post id belongs to exactly one type, so
 * the query for the wrong type simply returns nothing for it) — never a
 * single request assumed to return everything.
 *
 * Each chunk is resolved by its own `useEntityRecords` call, so this renders
 * one invisible query component per chunk rather than looping the hook inside
 * a single component, keeping every hook call unconditional per the rules of
 * hooks regardless of how many ids are being resolved.
 */

import { useEntityRecords } from '@wordpress/core-data';
import { useEffect } from '@wordpress/element';
import type { ContentRecord, ResolvedUserPage } from './Types';

/** Largest `include` list a single REST request is allowed. */
const CHUNK_SIZE = 100;

/**
 * Splits a list into consecutive chunks of at most `size` items.
 *
 * @param items The list to split.
 * @param size  Maximum size of each chunk.
 * @return The list split into chunks.
 */
function chunk< T >( items: T[], size: number ): T[][] {
	const chunks: T[][] = [];

	for ( let i = 0; i < items.length; i += size ) {
		chunks.push( items.slice( i, i + size ) );
	}

	return chunks;
}

/**
 * Queries a single post type for a single chunk of ids, reporting resolved
 * titles and types up as they arrive.
 *
 * @param props            Component props.
 * @param props.postType   The post type to query.
 * @param props.ids        The chunk of post ids to resolve (at most {@link CHUNK_SIZE}).
 * @param props.onResolved Called with the newly resolved id => info map.
 */
function ChunkQuery( {
	postType,
	ids,
	onResolved,
}: {
	postType: string;
	ids: number[];
	onResolved: ( info: Record< number, ResolvedUserPage > ) => void;
} ) {
	const { records } = useEntityRecords< ContentRecord >(
		'postType',
		postType,
		{
			include: ids,
			per_page: ids.length,
			_fields: 'id,title,type',
		}
	);

	useEffect( () => {
		if ( ! records || records.length === 0 ) {
			return;
		}

		const info: Record< number, ResolvedUserPage > = {};

		for ( const record of records ) {
			info[ record.id ] = {
				title: record.title?.rendered ?? '',
				type: record.type,
			};
		}

		onResolved( info );
		// `records` is the only value that changes when new data arrives;
		// `postType` is fixed per instance and `onResolved` is a stable
		// callback the caller memoizes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ records ] );

	return null;
}

/**
 * Resolves every user page's title and type from the saved order, in chunks
 * of at most 100 ids per selectable post type.
 *
 * @param props            Component props.
 * @param props.ids        Every user page id currently in the order.
 * @param props.postTypes  The selectable post types to query each chunk against.
 * @param props.onResolved Called with each chunk's resolved id => info map as it arrives.
 */
export function UserPageResolver( {
	ids,
	postTypes,
	onResolved,
}: {
	ids: number[];
	postTypes: string[];
	onResolved: ( info: Record< number, ResolvedUserPage > ) => void;
} ) {
	const chunks = chunk( ids, CHUNK_SIZE );

	return (
		<>
			{ chunks.flatMap( ( idsChunk, chunkIndex ) =>
				postTypes.map( ( postType ) => (
					<ChunkQuery
						key={ `${ postType }-${ chunkIndex }` }
						postType={ postType }
						ids={ idsChunk }
						onResolved={ onResolved }
					/>
				) )
			) }
		</>
	);
}
