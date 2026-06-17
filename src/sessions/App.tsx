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

import { DataViews, filterSortAndPaginate } from '@wordpress/dataviews/wp';
import type { Action, View } from '@wordpress/dataviews/wp';
import { useEntityRecords, store as coreStore } from '@wordpress/core-data';
import { useDispatch } from '@wordpress/data';
import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { buildFields } from './Fields';
import type { SessionRecord, SessionsConfig } from './Types';

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
		layout: {},
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

	return (
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
	);
}
