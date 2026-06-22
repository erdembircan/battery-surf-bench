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
import type { SessionRecord, SessionsConfig } from './Types';

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
const { SessionsApp } = await import( './App' );

const config: SessionsConfig = {
	postType: 'bsb_session',
	defaultColumns: [ 'bsb_status', 'bsb_level' ],
	fields: [
		{
			key: 'bsb_status',
			label: 'Status',
			format: 'status',
			elements: [ { value: 'finished', label: 'Finished' } ],
		},
		{ key: 'bsb_level', label: 'Battery', format: 'percent' },
		{ key: 'bsb_started_at', label: 'Started', format: 'datetime' },
	],
};

const records: SessionRecord[] = [
	{
		id: 1,
		title: { rendered: 'Older' },
		meta: { bsb_started_at: '2026-06-10 08:00:00', bsb_level: 0.5 },
	},
	{
		id: 2,
		title: { rendered: 'Newer' },
		meta: { bsb_started_at: '2026-06-16 08:00:00', bsb_level: 0.8 },
	},
];

/**
 * Renders the screen and returns the props the stubbed DataViews received.
 *
 * @param overrides             Overrides for the mocked `useEntityRecords` return.
 * @param overrides.records     The records the store resolves to; omit the key
 *                              to use the defaults, pass `undefined` for unresolved.
 * @param overrides.isResolving Whether the store reports a fetch in flight.
 * @return The captured DataViews props.
 */
function renderApp(
	overrides: { records?: SessionRecord[]; isResolving?: boolean } = {}
) {
	hooks.useEntityRecords.mockReturnValue( {
		records: 'records' in overrides ? overrides.records : records,
		isResolving: overrides.isResolving ?? false,
	} );
	render( <SessionsApp config={ config } /> );
	return hooks.dataViewsProps!;
}

beforeEach( () => {
	hooks.dataViewsProps = undefined;
} );

describe( 'SessionsApp data fetching', () => {
	it( 'queries the configured post type for the whole working set', () => {
		renderApp();
		expect( hooks.useEntityRecords ).toHaveBeenCalledWith(
			'postType',
			'bsb_session',
			{
				per_page: 100,
				status: 'any',
				_fields: 'id,title,status,date,meta',
			}
		);
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
	it( 'shows the sessions most-recent-start first by default', () => {
		const props = renderApp();
		const rows = props.data as SessionRecord[];
		expect( rows.map( ( row ) => row.id ) ).toEqual( [ 2, 1 ] );
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
			'meta.bsb_status',
			'meta.bsb_level',
			'meta.bsb_started_at',
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
			field: 'meta.bsb_started_at',
			direction: 'desc',
		} );
		expect( view.fields ).toEqual( [
			'meta.bsb_status',
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

	it( 'deletes every selected session through core-data', async () => {
		renderApp();
		await trashAction().callback( records );

		expect( hooks.deleteEntityRecord ).toHaveBeenCalledTimes( 2 );
		expect( hooks.deleteEntityRecord ).toHaveBeenCalledWith(
			'postType',
			'bsb_session',
			1,
			null
		);
		expect( hooks.deleteEntityRecord ).toHaveBeenCalledWith(
			'postType',
			'bsb_session',
			2,
			null
		);
	} );
} );
