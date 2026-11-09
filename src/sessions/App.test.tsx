/**
 * Behavioral tests for the sessions DataViews screen.
 *
 * DataViews is `SessionsApp`'s consumer, so these tests treat the props it
 * receives — the rows, the fields, the loading flag, the item id, and the
 * actions — as the observable contract, exactly what CLAUDE.md calls "what the
 * consumer sees and relies on". The real `filterSortAndPaginate` is kept, so
 * the rows asserted here are the ones App genuinely derives (default sort and
 * all); only the leaf grid renderer is stubbed to capture what it is handed.
 * The core-data hooks are mocked at the WordPress boundary the way the suite
 * would mock any external dependency.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { SessionRecord, SessionsConfig } from '@/sessions/Types';

const hooks = vi.hoisted( () => ( {
	useEntityRecords: vi.fn(),
	deleteEntityRecord: vi.fn(),
	dataViewsProps: undefined as Record< string, unknown > | undefined,
} ) );

vi.mock( '@wordpress/core-data', () => ( {
	useEntityRecords: hooks.useEntityRecords,
	store: { name: 'core' },
} ) );

vi.mock( '@wordpress/data', () => ( {
	useDispatch: () => ( { deleteEntityRecord: hooks.deleteEntityRecord } ),
} ) );

vi.mock( '@wordpress/dataviews', async () => {
	const actual = await vi.importActual<
		typeof import('@wordpress/dataviews')
	>( '@wordpress/dataviews' );
	return {
		...actual,
		DataViews: ( props: Record< string, unknown > ) => {
			hooks.dataViewsProps = props;
			return null;
		},
	};
} );

// Imported after the mocks so App binds to the stubbed DataViews.
const { SessionsApp, sessionUrl } = await import( '@/sessions/App' );

const config: SessionsConfig = {
	postType: 'bsbench_session',
	defaultColumns: [ 'bsbench_status', 'bsb_level' ],
	detailUrl: 'http://example.test/wp-admin/admin.php?page=bsbench-session',
	detailParam: 'bsbenchSessionId',
	fields: [
		{
			key: 'bsbench_status',
			label: 'Status',
			format: 'status',
			elements: [ { value: 'finished', label: 'Finished' } ],
		},
		{ key: 'bsb_level', label: 'Battery', format: 'percent' },
		{ key: 'bsbench_started_at', label: 'Started', format: 'datetime' },
	],
};

const records: SessionRecord[] = [
	{
		id: 1,
		title: { rendered: 'Older' },
		meta: { bsbench_started_at: '2026-06-10 08:00:00', bsb_level: 0.5 },
	},
	{
		id: 2,
		title: { rendered: 'Newer' },
		meta: { bsbench_started_at: '2026-06-16 08:00:00', bsb_level: 0.8 },
	},
];

/**
 * Renders the screen and returns the props the stubbed DataViews received.
 *
 * @param overrides             Overrides for the mocked `useEntityRecords` return.
 * @param overrides.records     The records the store resolves to; omit the key
 *                              to use the defaults, pass `undefined` for unresolved.
 * @param overrides.isResolving Whether the store reports a fetch in flight.
 * @param overrides.totalItems  The collection total the store reports.
 * @param overrides.totalPages  The page count the store reports.
 * @return The captured DataViews props.
 */
function renderApp(
	overrides: {
		records?: SessionRecord[];
		isResolving?: boolean;
		totalItems?: number | null;
		totalPages?: number | null;
	} = {}
) {
	const resolved = 'records' in overrides ? overrides.records : records;
	hooks.useEntityRecords.mockReturnValue( {
		records: resolved,
		isResolving: overrides.isResolving ?? false,
		totalItems:
			'totalItems' in overrides
				? overrides.totalItems
				: resolved?.length ?? null,
		totalPages: 'totalPages' in overrides ? overrides.totalPages : 1,
	} );
	render( <SessionsApp config={ config } /> );
	return hooks.dataViewsProps!;
}

beforeEach( () => {
	hooks.dataViewsProps = undefined;
} );

describe( 'SessionsApp data fetching', () => {
	it( 'queries the server for one page, derived from the view config', () => {
		renderApp();
		// The server orders, filters, searches and paginates — the client just
		// translates the view into query args, so the whole dataset is reachable.
		expect( hooks.useEntityRecords ).toHaveBeenCalledWith(
			'postType',
			'bsbench_session',
			{
				status: 'any',
				_fields: 'id,title,status,date,meta',
				page: 1,
				per_page: 25,
				orderby: 'bsbench_started_at',
				order: 'desc',
			}
		);
	} );

	it( 'passes the server totals through as the grid pagination info', () => {
		const props = renderApp( { totalItems: 87, totalPages: 4 } );
		expect( props.paginationInfo ).toEqual( {
			totalItems: 87,
			totalPages: 4,
		} );
	} );

	it( 'disables the search box — every column is numeric or enumerated', () => {
		expect( renderApp().search ).toBe( false );
	} );

	it( 'reflects the store resolving state as the grid loading flag', () => {
		expect( renderApp( { isResolving: true } ).isLoading ).toBe( true );
		expect( renderApp( { isResolving: false } ).isLoading ).toBe( false );
	} );

	it( 'renders without rows before the records resolve', () => {
		const props = renderApp( { records: undefined } );
		expect( props.data ).toEqual( [] );
	} );
} );

describe( 'SessionsApp rows', () => {
	it( 'passes the fetched page straight to the grid (the server orders it)', () => {
		const props = renderApp();
		expect( props.data ).toBe( records );
	} );

	it( 'identifies each row by its post id as a string', () => {
		const props = renderApp();
		const getItemId = props.getItemId as ( item: SessionRecord ) => string;
		expect( getItemId( records[ 0 ] ) ).toBe( '1' );
	} );

	it( 'builds the title field plus one field per descriptor', () => {
		const props = renderApp();
		const fields = props.fields as Array< { id: string; label: string } >;
		expect( fields.map( ( f ) => f.id ) ).toEqual( [
			'title',
			'meta.bsbench_status',
			'meta.bsb_level',
			'meta.bsbench_started_at',
		] );
	} );

	it( 'opens on a table sorted by start time with the default columns', () => {
		const props = renderApp();
		const view = props.view as {
			type: string;
			sort: { field: string; direction: string };
			fields: string[];
		};
		expect( view.type ).toBe( 'table' );
		expect( view.sort ).toEqual( {
			field: 'meta.bsbench_started_at',
			direction: 'desc',
		} );
		expect( view.fields ).toEqual( [
			'meta.bsbench_status',
			'meta.bsb_level',
		] );
	} );
} );

describe( 'SessionsApp trash action', () => {
	/**
	 * Reads the destructive trash action off the captured props.
	 *
	 * @return The trash action descriptor.
	 */
	function trashAction() {
		const actions = hooks.dataViewsProps!.actions as Array< {
			id: string;
			isDestructive?: boolean;
			supportsBulk?: boolean;
			icon?: unknown;
			callback: ( items: SessionRecord[] ) => Promise< void >;
		} >;
		return actions.find( ( action ) => action.id === 'trash' )!;
	}

	it( 'offers a destructive bulk trash action', () => {
		renderApp();
		const action = trashAction();
		expect( action.isDestructive ).toBe( true );
		expect( action.supportsBulk ).toBe( true );
	} );

	it( 'carries an icon so DataViews shows it in the bulk-actions footer', () => {
		renderApp();
		// DataViews only renders a bulk action when it has an icon, so the
		// icon is part of the action's observable contract here.
		expect( trashAction().icon ).toBeTruthy();
	} );

	it( 'deletes every selected session through core-data', async () => {
		renderApp();
		await trashAction().callback( records );

		expect( hooks.deleteEntityRecord ).toHaveBeenCalledTimes( 2 );
		expect( hooks.deleteEntityRecord ).toHaveBeenCalledWith(
			'postType',
			'bsbench_session',
			1,
			null
		);
		expect( hooks.deleteEntityRecord ).toHaveBeenCalledWith(
			'postType',
			'bsbench_session',
			2,
			null
		);
	} );
} );

describe( 'SessionsApp session total', () => {
	/**
	 * Adds the header count slot the PHP screen renders, so the App can portal
	 * the live total into it.
	 *
	 * @return The injected slot element.
	 */
	function addCountSlot(): HTMLElement {
		const slot = document.createElement( 'span' );
		slot.className = 'bsb-sessions__count';
		document.body.appendChild( slot );
		return slot;
	}

	it( 'fills the header slot with the server total, not the page length', () => {
		const slot = addCountSlot();
		// Two records on the page, but the collection holds 87 — the header
		// reports the grand total the pagination footer omits.
		renderApp( { totalItems: 87 } );
		expect( slot.textContent ).toBe( '87 sessions' );
		slot.remove();
	} );

	it( 'singularises a lone session', () => {
		const slot = addCountSlot();
		renderApp( { totalItems: 1 } );
		expect( slot.textContent ).toBe( '1 session' );
		slot.remove();
	} );

	it( 'leaves the slot empty until the total resolves', () => {
		const slot = addCountSlot();
		renderApp( { totalItems: null } );
		expect( slot.textContent ).toBe( '' );
		slot.remove();
	} );
} );

describe( 'sessionUrl', () => {
	it( 'points a session at the detail page, carrying its id in the localized parameter', () => {
		expect( sessionUrl( config, 42 ) ).toBe(
			'http://example.test/wp-admin/admin.php?page=bsbench-session&bsbenchSessionId=42'
		);
	} );
} );
