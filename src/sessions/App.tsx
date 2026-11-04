/**
 * The benchmark sessions listing, built on DataViews.
 *
 * DataViews is a controlled renderer: it owns no data of its own and emits the
 * view config (page, sort, filters) through `onChangeView`. This component
 * turns that config into a REST query and lets core-data fetch only the current
 * page from the server — so sorting, filtering and pagination run in the
 * database and the whole dataset is reachable, however large it grows. The
 * server side that teaches the REST collection to order and filter by meta
 * lives in `SessionRestQuery`. There is no free-text search: every column holds
 * either a number or an enumerated value, so filtering, not searching, is the
 * right tool — the search box is disabled.
 */

// Import the default `@wordpress/dataviews` build, not its self-contained
// `/wp` build. The default build leaves its `@wordpress/*` dependencies as bare
// imports, so the dependency-extraction plugin externalizes them to the
// `wp-components`, `wp-compose`, `wp-primitives` (etc.) handles WordPress
// enqueues — keeping the screen bundle ~120 KiB instead of bundling the whole
// of `@wordpress/components` and shipping ~1.7 MiB. Do not switch this to `/wp`.
import { DataViews } from '@wordpress/dataviews';
import type { Action, View } from '@wordpress/dataviews';
import { useEntityRecords, store as coreStore } from '@wordpress/core-data';
import { useDispatch } from '@wordpress/data';
import {
	createPortal,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { buildFields } from '@/sessions/Fields';
import type { SessionRecord, SessionsConfig } from '@/sessions/Types';

/**
 * The trash glyph for the row and bulk Trash action — the WordPress standard
 * trash icon (`@wordpress/icons`' `trash`), inlined because the project does
 * not depend on that package and DataViews only renders a bulk action in its
 * selection footer when the action carries an `icon`.
 */
const trashIcon = (
	<svg
		viewBox="0 0 24 24"
		width="24"
		height="24"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
		focusable="false"
	>
		<path
			fill="currentColor"
			d="M12 5.5A2.25 2.25 0 0 0 9.878 7h4.244A2.251 2.251 0 0 0 12 5.5ZM12 4a3.751 3.751 0 0 0-3.675 3H5v1.5h1.27l.818 8.997a2.75 2.75 0 0 0 2.739 2.501h4.347a2.75 2.75 0 0 0 2.738-2.5L17.73 8.5H19V7h-3.325A3.751 3.751 0 0 0 12 4Zm4.224 4.5H7.776l.806 8.861a1.25 1.25 0 0 0 1.245 1.137h4.347a1.25 1.25 0 0 0 1.245-1.137l.805-8.861Z"
		/>
	</svg>
);

/**
 * Strips the `meta.` prefix a DataViews field id carries, yielding the bare
 * meta key the REST query orders and filters by.
 *
 * @param field The field id (e.g. `meta.bsbench_status`).
 * @return The bare key (e.g. `bsbench_status`).
 */
function metaKey( field: string ): string {
	return field.replace( /^meta\./, '' );
}

/**
 * The native admin edit-screen URL for a session, where the detail postcard
 * replaces the editor. Relative to the listing screen (both live under
 * `wp-admin/`), so opening a session follows the ordinary WordPress flow rather
 * than a bespoke route.
 *
 * @param id The session post id.
 * @return The edit-screen URL.
 */
function sessionEditUrl( id: number ): string {
	return `post.php?post=${ id }&action=edit`;
}

/**
 * Opens a session on its native admin edit screen.
 *
 * @param item The session to open.
 */
function openSession( item: SessionRecord ): void {
	window.location.href = sessionEditUrl( item.id );
}

/**
 * Builds the initial view: a table sorted by most recent start, showing the
 * columns the schema marks as defaults.
 *
 * @param config The localized screen configuration.
 * @return The initial DataViews view state.
 */
function initialView( config: SessionsConfig ): View {
	return {
		type: 'table',
		page: 1,
		perPage: 25,
		search: '',
		filters: [],
		titleField: 'title',
		sort: { field: 'meta.bsbench_started_at', direction: 'desc' },
		fields: config.defaultColumns.map( ( key ) => `meta.${ key }` ),
		layout: { density: 'compact' },
	};
}

/**
 * Translates the DataViews view config into REST query args the server uses to
 * page, order and filter the collection. `orderby` is sent as a meta key (or
 * `id` for the session column) and each active filter as its meta-key
 * parameter — both resolved server-side by the `SessionRestQuery` manager.
 *
 * @param view The current view config.
 * @return The REST query args.
 */
function viewToQuery( view: View ): Record< string, unknown > {
	const query: Record< string, unknown > = {
		status: 'any',
		_fields: 'id,title,status,date,meta',
		page: view.page ?? 1,
		per_page: view.perPage ?? 25,
	};

	if ( view.sort?.field ) {
		query.orderby =
			view.sort.field === 'title' ? 'id' : metaKey( view.sort.field );
		query.order = view.sort.direction ?? 'desc';
	}

	for ( const filter of view.filters ?? [] ) {
		const value = Array.isArray( filter.value )
			? filter.value
			: [ filter.value ];
		query[ metaKey( filter.field ) ] = value;
	}

	return query;
}

/**
 * Renders the sessions DataViews screen.
 *
 * @param props        Component props.
 * @param props.config The localized screen configuration.
 * @return The listing element.
 */
export function SessionsApp( { config }: { config: SessionsConfig } ) {
	const fields = useMemo(
		() => buildFields( config.fields ),
		[ config.fields ]
	);
	const [ view, setView ] = useState< View >( () => initialView( config ) );

	const query = useMemo( () => viewToQuery( view ), [ view ] );

	const { records, isResolving, totalItems, totalPages } =
		useEntityRecords< SessionRecord >( 'postType', config.postType, query );

	const { deleteEntityRecord } = useDispatch( coreStore );

	const paginationInfo = useMemo(
		() => ( {
			totalItems: totalItems ?? 0,
			totalPages: totalPages ?? 0,
		} ),
		[ totalItems, totalPages ]
	);

	const actions = useMemo< Action< SessionRecord >[] >(
		() => [
			{
				id: 'trash',
				label: __( 'Trash', 'battery-surf-bench' ),
				icon: trashIcon,
				isDestructive: true,
				supportsBulk: true,
				callback: async ( items ) => {
					await Promise.all(
						items.map( ( item ) =>
							deleteEntityRecord(
								'postType',
								config.postType,
								item.id,
								null
							)
						)
					);
				},
			},
		],
		[ deleteEntityRecord, config.postType ]
	);

	// DataViews opens an item from its title cell (onClickItem) but toggles row
	// selection when the row body is clicked. The maintainer wants the whole row
	// to open and the checkbox alone to select, so this intercepts row-body
	// clicks in the capture phase — before DataViews' own row handler runs — and
	// routes to that session's edit screen, leaving the checkbox, the row actions
	// and the title button (which opens via onClickItem) to their own controls.
	const rootRef = useRef< HTMLDivElement >( null );

	const onRowClick = useCallback( ( event: MouseEvent ): void => {
		const target = event.target as HTMLElement | null;

		if (
			! target ||
			target.closest(
				'.dataviews-view-table__checkbox-column, .dataviews-view-table__actions-column, a, button, input, [role="button"]'
			)
		) {
			return;
		}

		const row = target.closest( '.dataviews-view-table__row' );
		const id = row
			?.querySelector( '[data-bsb-id]' )
			?.getAttribute( 'data-bsb-id' );

		if ( ! id ) {
			return;
		}

		// Stop DataViews' own row-selection handler from also firing.
		event.stopPropagation();
		window.location.href = sessionEditUrl( Number( id ) );
	}, [] );

	useEffect( () => {
		const root = rootRef.current;
		if ( ! root ) {
			return undefined;
		}
		root.addEventListener( 'click', onRowClick, true );
		return () => root.removeEventListener( 'click', onRowClick, true );
	}, [ onRowClick ] );

	// The brand header (rendered by PHP, outside this root) carries the running
	// total. DataViews' pagination only reports "Page X of Y" and its footer
	// counts the current page, so the server's total for the current query is
	// portalled into the header slot here — live, and correct after a delete.
	const countSlot =
		typeof document !== 'undefined'
			? document.querySelector( '.bsb-sessions__count' )
			: null;
	const countLabel =
		totalItems === null || totalItems === undefined
			? null
			: sprintf(
					/* translators: %s: number of benchmark sessions. */
					_n(
						'%s session',
						'%s sessions',
						totalItems,
						'battery-surf-bench'
					),
					String( totalItems )
			  );

	return (
		// `display: contents` so the wrapper carries the row-click listener
		// without inserting a box that would disturb the screen's layout.
		<div ref={ rootRef } style={ { display: 'contents' } }>
			<DataViews< SessionRecord >
				data={ records ?? [] }
				fields={ fields }
				view={ view }
				onChangeView={ setView }
				actions={ actions }
				paginationInfo={ paginationInfo }
				defaultLayouts={ { table: {} } }
				isLoading={ isResolving }
				getItemId={ ( item ) => String( item.id ) }
				search={ false }
				isItemClickable={ () => true }
				onClickItem={ openSession }
			/>
			{ countSlot &&
				countLabel !== null &&
				createPortal( countLabel, countSlot ) }
		</div>
	);
}
