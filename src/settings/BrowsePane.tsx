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
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useSearchResults } from './SearchQuery';
import type { BundledCatalogEntry, InitialBrowse, SearchRecord } from './Types';

/** Rows fetched per page — deliberately small, since this is a real REST page, not a client-side slice. */
const PER_PAGE = 10;

/** How long a keystroke waits before it re-queries the server. */
const SEARCH_DEBOUNCE_MS = 300;

type BrowseType = 'all' | 'page' | 'post' | 'builtin';

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
 * Renders one browse row: title, type badge, and an Add / Added action — the
 * shared shape both a real search result ({@see BrowseRow}) and a bundled
 * catalog entry ({@see BuiltinRow}) render into.
 *
 * @param props                 Component props.
 * @param props.title           The row's title.
 * @param props.badge           The type badge to render — the class suffix and its label.
 * @param props.badge.className The badge's class-name suffix (`bsb-badge--<className>`).
 * @param props.badge.label     The badge's translated label text.
 * @param props.isAdded         Whether this row is already in the surf sequence.
 * @param props.disabled        Whether the Add action is disabled — while a save is in flight, so the sequence can't change mid-save.
 * @param props.onAdd           Called when the row's Add button is activated.
 */
function ContentRow( {
	title,
	badge,
	isAdded,
	disabled,
	onAdd,
}: {
	title: string;
	badge: { className: string; label: string };
	isAdded: boolean;
	disabled: boolean;
	onAdd: () => void;
} ) {
	return (
		<div className="bsb-browse__row">
			<div className="bsb-browse__row-main">
				<span className="bsb-browse__row-title">{ title }</span>
				<span className={ `bsb-badge bsb-badge--${ badge.className }` }>
					{ badge.label }
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
 * Renders one real search-result row: title, Page/Post badge, and an Add /
 * Added action.
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
		<ContentRow
			title={ title }
			badge={
				record.subtype === 'post'
					? {
							className: 'post',
							label: __( 'Post', 'battery-surf-bench' ),
					  }
					: {
							className: 'page',
							label: __( 'Page', 'battery-surf-bench' ),
					  }
			}
			isAdded={ isAdded }
			disabled={ disabled }
			onAdd={ onAdd }
		/>
	);
}

/**
 * Renders one bundled-catalog row: title, "Built-in" badge, and an Add /
 * Added action — sourced client-side from `config.bundledCatalog`, since the
 * plugin's own bundled pages never live in `/wp/v2/search`.
 *
 * @param props          Component props.
 * @param props.page     The bundled catalog entry to render.
 * @param props.isAdded  Whether this page is already in the surf sequence.
 * @param props.disabled Whether the Add action is disabled — while a save is in flight, so the sequence can't change mid-save.
 * @param props.onAdd    Called when the row's Add button is activated.
 */
function BuiltinRow( {
	page,
	isAdded,
	disabled,
	onAdd,
}: {
	page: BundledCatalogEntry;
	isAdded: boolean;
	disabled: boolean;
	onAdd: () => void;
} ) {
	return (
		<ContentRow
			title={ page.title }
			badge={ {
				className: 'bundled',
				label: __( 'Built-in', 'battery-surf-bench' ),
			} }
			isAdded={ isAdded }
			disabled={ disabled }
			onAdd={ onAdd }
		/>
	);
}

/**
 * Whether a bundled catalog entry's title matches a search string — a plain
 * client-side, case-insensitive substring match, since the bundled catalog is
 * a short, fixed list that never needs a server round trip to filter.
 *
 * @param page   The bundled catalog entry to test.
 * @param search The search string, already trimmed of debounce noise.
 * @return Whether the entry matches.
 */
function matchesBuiltin( page: BundledCatalogEntry, search: string ): boolean {
	const query = search.trim().toLowerCase();
	return query === '' || page.title.toLowerCase().includes( query );
}

/**
 * Renders the Browse pane.
 *
 * @param props                Component props.
 * @param props.postTypes      The selectable post types (`['page','post']`).
 * @param props.selectedIds    Post ids already in the surf sequence, so their rows show as Added.
 * @param props.bundledCatalog The plugin's bundled pages — the source for the "Built-in" filter and the rows pinned atop the "All" filter's first page.
 * @param props.selectedSlugs  Bundled catalog slugs already in the surf sequence, so their rows show as Added.
 * @param props.saving         Whether a save is in flight — shields the pane and disables every Add button, so the sequence can't change mid-save.
 * @param props.onAdd          Called with a record's id, subtype and title when its row is added.
 * @param props.onAddBundled   Called with a bundled page's slug and title when its row is added.
 * @param props.onFetchError   Called with whether the most recent request failed, so the screen can raise/clear its bottom error toast. Omit if the caller doesn't need it (e.g. in tests).
 * @param props.initialBrowse  The server-seeded first page for the default query (empty search, every selectable subtype, page 1) — painted on mount instead of fetching it.
 */
export function BrowsePane( {
	postTypes,
	selectedIds,
	bundledCatalog,
	selectedSlugs,
	saving,
	onAdd,
	onAddBundled,
	onFetchError,
	initialBrowse,
}: {
	postTypes: string[];
	selectedIds: Set< number >;
	bundledCatalog: BundledCatalogEntry[];
	selectedSlugs: Set< string >;
	saving: boolean;
	onAdd: ( id: number, subtype: string, title: string ) => void;
	onAddBundled: ( slug: string, title: string ) => void;
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

	// The "Built-in" tab has no real-content subtype of its own — it renders
	// no search-endpoint rows at all, so its subtype value here is moot; "all"
	// keeps the hook's own args stable rather than switching on a value that
	// is never actually rendered.
	const subtype =
		type === 'all' || type === 'builtin' ? postTypes.join( ',' ) : type;

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

	// The bundled catalog is a short, fixed list, so it is filtered entirely
	// client-side — never sent through the search endpoint (it isn't even
	// indexed there). Used both by the "Built-in" tab (the only rows it
	// shows) and by the "All" tab's page-1 pin.
	const builtinMatches = useMemo(
		() =>
			bundledCatalog.filter( ( catalogPage ) =>
				matchesBuiltin( catalogPage, debouncedSearch )
			),
		[ bundledCatalog, debouncedSearch ]
	);

	const isBuiltin = type === 'builtin';
	// Pinned atop page 1 of the "All" filter only — pages 2+ show only the
	// real-content rows, and the Pages/Posts filters never pin anything, so
	// the built-in set doesn't crowd out real content once it's not on
	// screen 1 of "All".
	const pinnedBuiltin = type === 'all' && page === 1 ? builtinMatches : [];

	const searchPlaceholder = isBuiltin
		? __( 'Search built-in pages…', 'battery-surf-bench' )
		: __( 'Search all pages and posts…', 'battery-surf-bench' );

	const caption = isBuiltin
		? __(
				'The pages that ship with Battery Surf Bench.',
				'battery-surf-bench'
		  )
		: __(
				'Searches your whole site, not just this page.',
				'battery-surf-bench'
		  );

	// The spinner in the results container below is the one busy indicator —
	// this text goes empty (not a stale count, not a "Loading…" label) while
	// resolving. A non-breaking space plus `.bsb-browse__meta`'s own
	// `min-height` keep the line's height reserved either way, so emptying it
	// never shifts the layout. The "Built-in" tab never resolves a real
	// request, so its own count is never held back by `isResolving`/`isError`.
	let metaText: string;
	if ( isBuiltin ) {
		metaText = sprintf(
			/* translators: %s: number of built-in pages. */
			_n(
				'%s built-in page',
				'%s built-in pages',
				builtinMatches.length,
				'battery-surf-bench'
			),
			String( builtinMatches.length )
		);
	} else if ( isResolving || isError ) {
		metaText = '\u00A0';
	} else {
		const pinnedSuffix = pinnedBuiltin.length
			? sprintf(
					/* translators: %s: number of built-in pages pinned on top. */
					__( '· %s built-in on top', 'battery-surf-bench' ),
					String( pinnedBuiltin.length )
			  )
			: '';
		metaText = sprintf(
			/* translators: 1: total number of items, 2: first item shown, 3: last item shown, 4: built-in pages pinned on top, if any. */
			__( '%1$s items · showing %2$s–%3$s %4$s', 'battery-surf-bench' ),
			String( totalItems ),
			String( rangeStart ),
			String( rangeEnd ),
			pinnedSuffix
		).trim();
	}

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
					<button
						type="button"
						className={ `bsb-seg__option${
							isBuiltin ? ' is-active' : ''
						}` }
						onClick={ () => setType( 'builtin' ) }
					>
						{ __( 'Built-in', 'battery-surf-bench' ) }
					</button>
				</div>
				<div className="bsb-search">
					<input
						type="search"
						autoComplete="off"
						aria-label={ searchPlaceholder }
						placeholder={ searchPlaceholder }
						value={ search }
						onChange={ ( event ) =>
							setSearch( event.target.value )
						}
					/>
				</div>
			</div>
			<p className="bsb-browse__caption">{ caption }</p>
			<p className="bsb-browse__meta">{ metaText }</p>

			<div className="bsb-browse__list">
				{ ! isBuiltin && isResolving ? (
					<div className="bsb-browse__busy">
						<Spinner />
					</div>
				) : (
					<>
						{ pinnedBuiltin.length === 0 &&
							( isBuiltin
								? builtinMatches.length === 0
								: records.length === 0 ) && (
								<div className="bsb-browse__empty">
									{ isBuiltin
										? __(
												'No built-in pages match your search.',
												'battery-surf-bench'
										  )
										: __(
												'No pages or posts match your search.',
												'battery-surf-bench'
										  ) }
								</div>
							) }
						{ pinnedBuiltin.map( ( catalogPage ) => (
							<BuiltinRow
								key={ `builtin-${ catalogPage.slug }` }
								page={ catalogPage }
								isAdded={ selectedSlugs.has(
									catalogPage.slug
								) }
								disabled={ saving }
								onAdd={ () =>
									onAddBundled(
										catalogPage.slug,
										catalogPage.title
									)
								}
							/>
						) ) }
						{ isBuiltin
							? builtinMatches.map( ( catalogPage ) => (
									<BuiltinRow
										key={ `builtin-${ catalogPage.slug }` }
										page={ catalogPage }
										isAdded={ selectedSlugs.has(
											catalogPage.slug
										) }
										disabled={ saving }
										onAdd={ () =>
											onAddBundled(
												catalogPage.slug,
												catalogPage.title
											)
										}
									/>
							  ) )
							: records.map( ( record ) => (
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

			{ ! isBuiltin && (
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
			) }

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
