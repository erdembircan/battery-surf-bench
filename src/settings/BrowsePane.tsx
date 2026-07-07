/**
 * The Browse pane: a paginated, server-searched list of the site's own posts
 * and pages, fed straight from `useEntityRecords` — the same data layer
 * Sessions uses for its DataViews grid, minus the `<DataViews>` component
 * itself (decision #7: too opinionated to theme onto this bespoke picker).
 *
 * "All" queries both selectable post types unconditionally (an `enabled`
 * option skips the network request for whichever type isn't shown) so the
 * number of hook calls this component makes never changes across renders,
 * keeping the rules of hooks intact while still never issuing a single
 * request for more than one page's worth of results.
 */

import { useEntityRecords } from '@wordpress/core-data';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { ContentRecord } from './Types';

/** Rows fetched per page — deliberately small, since this is a real REST page, not a client-side slice. */
const PER_PAGE = 10;

/** How long a keystroke waits before it re-queries the server. */
const SEARCH_DEBOUNCE_MS = 300;

type BrowseType = 'all' | 'page' | 'post';

/**
 * Debounces a fast-changing value, so a search query is not re-issued on
 * every keystroke.
 *
 * @param value The latest value.
 * @param delay Milliseconds to wait before adopting it.
 * @return The debounced value.
 */
function useDebouncedValue< T >( value: T, delay: number ): T {
	const [ debounced, setDebounced ] = useState( value );

	useEffect( () => {
		const timer = setTimeout( () => setDebounced( value ), delay );
		return () => clearTimeout( timer );
	}, [ value, delay ] );

	return debounced;
}

/**
 * Renders one browse row: title, type badge, and an Add / Added action.
 *
 * @param props         Component props.
 * @param props.record  The post or page to render.
 * @param props.isAdded Whether this record is already in the surf sequence.
 * @param props.onAdd   Called when the row's Add button is activated.
 */
function BrowseRow( {
	record,
	isAdded,
	onAdd,
}: {
	record: ContentRecord;
	isAdded: boolean;
	onAdd: () => void;
} ) {
	const title =
		record.title?.rendered || __( '(untitled)', 'battery-surf-bench' );

	return (
		<div className="bsb-browse__row">
			<div className="bsb-browse__row-main">
				<span className="bsb-browse__row-title">{ title }</span>
				<span
					className={ `bsb-badge bsb-badge--${
						record.type === 'post' ? 'post' : 'page'
					}` }
				>
					{ record.type === 'post'
						? __( 'Post', 'battery-surf-bench' )
						: __( 'Page', 'battery-surf-bench' ) }
				</span>
			</div>
			{ isAdded ? (
				<span
					className="bsb-ghost-btn bsb-ghost-btn--added"
					aria-disabled="true"
				>
					{ __( 'Added', 'battery-surf-bench' ) }
				</span>
			) : (
				<button
					type="button"
					className="bsb-ghost-btn"
					onClick={ onAdd }
				>
					{ __( 'Add', 'battery-surf-bench' ) }
				</button>
			) }
		</div>
	);
}

/**
 * Renders the Browse pane.
 *
 * @param props             Component props.
 * @param props.postTypes   The selectable post types (`['page','post']`).
 * @param props.selectedIds Post ids already in the surf sequence, so their rows show as Added.
 * @param props.onAdd       Called with a record's id, type and title when its row is added.
 */
export function BrowsePane( {
	postTypes,
	selectedIds,
	onAdd,
}: {
	postTypes: string[];
	selectedIds: Set< number >;
	onAdd: ( id: number, type: string, title: string ) => void;
} ) {
	const [ type, setType ] = useState< BrowseType >( 'all' );
	const [ search, setSearch ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const debouncedSearch = useDebouncedValue( search, SEARCH_DEBOUNCE_MS );

	// A new query always starts back at page 1.
	useEffect( () => {
		setPage( 1 );
	}, [ type, debouncedSearch ] );

	const queryArgs = {
		search: debouncedSearch,
		page,
		per_page: PER_PAGE,
		status: 'publish',
		_fields: 'id,title,link,type',
	};

	const pageEnabled = postTypes.includes( 'page' ) && type !== 'post';
	const postEnabled = postTypes.includes( 'post' ) && type !== 'page';

	const pageResult = useEntityRecords< ContentRecord >(
		'postType',
		'page',
		queryArgs,
		{ enabled: pageEnabled }
	);
	const postResult = useEntityRecords< ContentRecord >(
		'postType',
		'post',
		queryArgs,
		{ enabled: postEnabled }
	);

	const records: ContentRecord[] = [
		...( pageEnabled ? pageResult.records ?? [] : [] ),
		...( postEnabled ? postResult.records ?? [] : [] ),
	].slice( 0, PER_PAGE );

	const totalItems =
		( pageEnabled ? pageResult.totalItems ?? 0 : 0 ) +
		( postEnabled ? postResult.totalItems ?? 0 : 0 );
	const totalPages = Math.max(
		1,
		pageEnabled ? pageResult.totalPages ?? 1 : 1,
		postEnabled ? postResult.totalPages ?? 1 : 1
	);
	const isResolving =
		( pageEnabled && pageResult.isResolving ) ||
		( postEnabled && postResult.isResolving );

	const rangeStart = totalItems === 0 ? 0 : ( page - 1 ) * PER_PAGE + 1;
	const rangeEnd = totalItems === 0 ? 0 : rangeStart + records.length - 1;

	return (
		<div className="bsb-picker__pane bsb-browse">
			<div className="bsb-picker__pane-head">
				<h4 className="bsb-pages-group__title">
					{ __( 'Browse your content', 'battery-surf-bench' ) }
				</h4>
			</div>

			<div className="bsb-browse__controls">
				<div
					className="bsb-seg"
					role="group"
					aria-label={ __(
						'Filter by content type',
						'battery-surf-bench'
					) }
				>
					<button
						type="button"
						className={ `bsb-seg__option${
							type === 'all' ? ' is-active' : ''
						}` }
						onClick={ () => setType( 'all' ) }
					>
						{ __( 'All', 'battery-surf-bench' ) }
					</button>
					<button
						type="button"
						className={ `bsb-seg__option${
							type === 'page' ? ' is-active' : ''
						}` }
						onClick={ () => setType( 'page' ) }
					>
						{ __( 'Pages', 'battery-surf-bench' ) }
					</button>
					<button
						type="button"
						className={ `bsb-seg__option${
							type === 'post' ? ' is-active' : ''
						}` }
						onClick={ () => setType( 'post' ) }
					>
						{ __( 'Posts', 'battery-surf-bench' ) }
					</button>
				</div>
				<div className="bsb-search">
					<input
						type="search"
						autoComplete="off"
						aria-label={ __(
							'Search all pages and posts',
							'battery-surf-bench'
						) }
						placeholder={ __(
							'Search all pages and posts…',
							'battery-surf-bench'
						) }
						value={ search }
						onChange={ ( event ) =>
							setSearch( event.target.value )
						}
					/>
				</div>
			</div>
			<p className="bsb-browse__caption">
				{ __(
					'Searches your whole site, not just this page.',
					'battery-surf-bench'
				) }
			</p>
			<p className="bsb-browse__meta">
				{ sprintf(
					/* translators: 1: total number of items, 2: first item shown, 3: last item shown. */
					__(
						'%1$s items · showing %2$s–%3$s',
						'battery-surf-bench'
					),
					String( totalItems ),
					String( rangeStart ),
					String( rangeEnd )
				) }
			</p>

			<div className="bsb-browse__list">
				{ records.length === 0 && ! isResolving && (
					<div className="bsb-browse__empty">
						{ __(
							'No pages or posts match your search.',
							'battery-surf-bench'
						) }
					</div>
				) }
				{ records.map( ( record ) => (
					<BrowseRow
						key={ `${ record.type }-${ record.id }` }
						record={ record }
						isAdded={ selectedIds.has( record.id ) }
						onAdd={ () =>
							onAdd(
								record.id,
								record.type,
								record.title?.rendered ?? ''
							)
						}
					/>
				) ) }
			</div>

			<div className="bsb-browse__pager">
				<button
					type="button"
					className="bsb-pager-btn"
					disabled={ page <= 1 }
					onClick={ () => setPage( ( current ) => current - 1 ) }
				>
					{ __( '‹ Prev', 'battery-surf-bench' ) }
				</button>
				<span className="bsb-pager-label">
					{ sprintf(
						/* translators: 1: current page, 2: total pages. */
						__( 'Page %1$s of %2$s', 'battery-surf-bench' ),
						String( page ),
						String( totalPages )
					) }
				</span>
				<button
					type="button"
					className="bsb-pager-btn"
					disabled={ page >= totalPages }
					onClick={ () => setPage( ( current ) => current + 1 ) }
				>
					{ __( 'Next ›', 'battery-surf-bench' ) }
				</button>
			</div>
		</div>
	);
}
