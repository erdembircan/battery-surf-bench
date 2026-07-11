/**
 * The Browse pane: a paginated, server-searched list of the site's own posts
 * and pages, fed by a single `/wp/v2/search` query ({@see useSearchResults}) —
 * the one core collection that already unifies multiple post types behind
 * genuine server pagination and server search, so the "All" tab is one
 * correctly-paginated request rather than two per-type requests merged and
 * sliced client-side (which drops items past 10 total results and 400s once
 * one type's page cursor runs past its own last page).
 */

import { Spinner } from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { useSearchResults } from './SearchQuery';
import type { InitialBrowse, SearchRecord } from './Types';

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
 * @param props          Component props.
 * @param props.record   The search result to render.
 * @param props.isAdded  Whether this record is already in the surf sequence.
 * @param props.disabled Whether the Add action is disabled — while a save is in flight, so the sequence can't change mid-save.
 * @param props.onAdd    Called when the row's Add button is activated.
 */
function BrowseRow( {
	record,
	isAdded,
	disabled,
	onAdd,
}: {
	record: SearchRecord;
	isAdded: boolean;
	disabled: boolean;
	onAdd: () => void;
} ) {
	const title = record.title || __( '(untitled)', 'battery-surf-bench' );

	return (
		<div className="bsb-browse__row">
			<div className="bsb-browse__row-main">
				<span className="bsb-browse__row-title">{ title }</span>
				<span
					className={ `bsb-badge bsb-badge--${
						record.subtype === 'post' ? 'post' : 'page'
					}` }
				>
					{ record.subtype === 'post'
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
					disabled={ disabled }
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
 * @param props               Component props.
 * @param props.postTypes     The selectable post types (`['page','post']`).
 * @param props.selectedIds   Post ids already in the surf sequence, so their rows show as Added.
 * @param props.saving        Whether a save is in flight — shields the pane and disables every Add button, so the sequence can't change mid-save.
 * @param props.onAdd         Called with a record's id, subtype and title when its row is added.
 * @param props.onFetchError  Called with whether the most recent request failed, so the screen can raise/clear its bottom error toast. Omit if the caller doesn't need it (e.g. in tests).
 * @param props.initialBrowse The server-seeded first page for the default query (empty search, every selectable subtype, page 1) — painted on mount instead of fetching it.
 */
export function BrowsePane( {
	postTypes,
	selectedIds,
	saving,
	onAdd,
	onFetchError,
	initialBrowse,
}: {
	postTypes: string[];
	selectedIds: Set< number >;
	saving: boolean;
	onAdd: ( id: number, subtype: string, title: string ) => void;
	onFetchError?: ( isError: boolean ) => void;
	initialBrowse?: InitialBrowse;
} ) {
	const [ type, setType ] = useState< BrowseType >( 'all' );
	const [ search, setSearch ] = useState( '' );
	const [ page, setPage ] = useState( 1 );
	const debouncedSearch = useDebouncedValue( search, SEARCH_DEBOUNCE_MS );

	// A new query always starts back at page 1.
	useEffect( () => {
		setPage( 1 );
	}, [ type, debouncedSearch ] );

	const subtype = type === 'all' ? postTypes.join( ',' ) : type;

	// The seed was fetched server-side for exactly this default query (the
	// "All" tab, no search, page 1) — only offer it to the hook while the
	// current args still describe that default. `useSearchResults` itself
	// only ever consumes it on the very first render regardless, so this just
	// avoids seeding a query the PHP side never actually ran.
	const isDefaultQuery =
		type === 'all' && debouncedSearch === '' && page === 1;

	const { records, totalItems, totalPages, isResolving, isError } =
		useSearchResults(
			{
				search: debouncedSearch,
				subtype,
				page,
				perPage: PER_PAGE,
			},
			isDefaultQuery ? initialBrowse : undefined
		);

	// The actual error surfaces as the screen's shared bottom toast, not
	// inline here — this pane's own states stay just spinner/empty/rows; a
	// failed request also settles with `records` emptied, so it falls through
	// to the same empty-state text a genuine no-matches result would show.
	useEffect( () => {
		onFetchError?.( isError );
	}, [ isError, onFetchError ] );

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
			{ /* The spinner in the results container below is the one busy
			indicator — this line goes empty (not a stale count, not a
			"Loading…" label) while resolving. A non-breaking space plus
			`.bsb-browse__meta`'s own `min-height` keep the line's height
			reserved either way, so emptying it never shifts the layout. */ }
			<p className="bsb-browse__meta">
				{ isResolving || isError
					? '\u00A0'
					: sprintf(
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
				{ isResolving ? (
					<div className="bsb-browse__busy">
						<Spinner />
					</div>
				) : (
					<>
						{ records.length === 0 && (
							<div className="bsb-browse__empty">
								{ __(
									'No pages or posts match your search.',
									'battery-surf-bench'
								) }
							</div>
						) }
						{ records.map( ( record ) => (
							<BrowseRow
								key={ `${ record.subtype }-${ record.id }` }
								record={ record }
								isAdded={ selectedIds.has( record.id ) }
								disabled={ saving }
								onAdd={ () =>
									onAdd(
										record.id,
										record.subtype,
										record.title
									)
								}
							/>
						) ) }
					</>
				) }
			</div>

			<div className="bsb-browse__pager">
				<button
					type="button"
					className="bsb-pager-btn"
					disabled={ page <= 1 || isResolving || saving }
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
					disabled={ page >= totalPages || isResolving || saving }
					onClick={ () => setPage( ( current ) => current + 1 ) }
				>
					{ __( 'Next ›', 'battery-surf-bench' ) }
				</button>
			</div>

			{ /* Shields the whole pane while a save is in flight — blocks pointer
			input (the buttons above are also individually disabled, but this is
			the visual + interaction backstop the maintainer asked for alongside
			the code guards in App.tsx) and shows a spinner so the freeze reads
			as "saving", not "stuck". */ }
			{ saving && (
				<div className="bsb-pane-overlay">
					<Spinner />
				</div>
			) }
		</div>
	);
}
