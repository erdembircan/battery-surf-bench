/**
 * The benchmark sessions listing, built on DataViews.
 *
 * DataViews is a controlled renderer: this component owns the data and the view
 * state and re-derives the rows whenever either changes. The sessions come
 * straight from the post type's REST endpoint through core-data, with every
 * datum already present under `meta` — so the fields read it by dot-path and no
 * bespoke data plumbing is needed. Sorting, filtering and pagination run on the
 * client via `filterSortAndPaginate`, which suits the modest number of sessions
 * a benchmarking tool accumulates.
 */

// Import the default `@wordpress/dataviews` build, not its self-contained
// `/wp` build. The default build leaves its `@wordpress/*` dependencies as bare
// imports, so the dependency-extraction plugin externalizes them to the
// `wp-components`, `wp-compose`, `wp-primitives` (etc.) handles WordPress
// enqueues — keeping the screen bundle ~120 KiB instead of bundling the whole
// of `@wordpress/components` and shipping ~1.7 MiB. Do not switch this to `/wp`.
import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews';
import type { Action, View } from '@wordpress/dataviews';
import { useEntityRecords, store as coreStore } from '@wordpress/core-data';
import { useDispatch } from '@wordpress/data';
import { createPortal, useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { buildFields } from './Fields';
import type { SessionRecord, SessionsConfig } from './Types';

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
 * The number of sessions fetched in one request. The client owns sorting and
 * filtering, so the whole working set is pulled once.
 */
const FETCH_SIZE = 100;

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
		sort: { field: 'meta.bsb_started_at', direction: 'desc' },
		fields: config.defaultColumns.map( ( key ) => `meta.${ key }` ),
		layout: { density: 'compact' },
	};
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

	const { records, isResolving } = useEntityRecords< SessionRecord >(
		'postType',
		config.postType,
		{
			per_page: FETCH_SIZE,
			status: 'any',
			_fields: 'id,title,status,date,meta',
		}
	);

	const { deleteEntityRecord } = useDispatch( coreStore );

	const { data, paginationInfo } = useMemo(
		() => filterSortAndPaginate( records ?? [], view, fields ),
		[ records, view, fields ]
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

	// The brand header (rendered by PHP, outside this root) carries the running
	// total. DataViews' pagination only reports "Page X of Y" and its footer
	// counts the current page, so the live grand total is portalled into the
	// header slot here — keeping it correct after a delete, where a server-
	// rendered number would go stale.
	const total = records?.length;
	const countSlot =
		typeof document !== 'undefined'
			? document.querySelector( '.bsb-sessions__count' )
			: null;
	const countLabel =
		total === undefined
			? null
			: sprintf(
					/* translators: %s: number of benchmark sessions. */
					_n(
						'%s session',
						'%s sessions',
						total,
						'battery-surf-bench'
					),
					total
			  );

	return (
		<>
			<DataViews< SessionRecord >
				data={ data }
				fields={ fields }
				view={ view }
				onChangeView={ setView }
				actions={ actions }
				paginationInfo={ paginationInfo }
				defaultLayouts={ { table: {} } }
				isLoading={ isResolving }
				getItemId={ ( item ) => String( item.id ) }
			/>
			{ countSlot &&
				countLabel !== null &&
				createPortal( countLabel, countSlot ) }
		</>
	);
}
