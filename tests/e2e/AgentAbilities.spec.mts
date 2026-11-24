import {
	test,
	expect,
	type APIRequestContext,
	type APIResponse,
} from '@playwright/test';
import { ADMIN_STORAGE_STATE } from '../../wp-playground/config.mts';

/**
 * End-to-end coverage for the plugin's AI agent abilities.
 *
 * The abilities register with WordPress core's Abilities API, which serves
 * them over its own REST routes, and the MCP Adapter plugin (installed by
 * `e2eBlueprint`) serves them to MCP clients. This drives both against real
 * WordPress: it seeds its own runs and pages over REST, runs every ability
 * through `wp-abilities/v1`, and calls the adapter's default MCP server the way
 * an MCP client does. The course option is recorded first and restored last,
 * and everything the spec creates is removed, so the other specs see the site
 * as they expect it. The blueprint enables WP_DEBUG_DISPLAY, so a PHP notice in
 * any response would surface as malformed JSON.
 */

const NAMESPACE = 'battery-surf-bench';
const ABILITIES = '/wp-json/wp-abilities/v1/abilities';
const MCP_ENDPOINT = '/wp-json/mcp/mcp-adapter-default-server';
const BROWSER = 'E2E-Agent';

const ABILITY_NAMES = [
	'add-course-page',
	'compare-runs',
	'find-pages',
	'get-cockpit-link',
	'get-course',
	'get-drain-stats',
	'get-run',
	'get-run-readings',
	'list-runs',
	'move-course-page',
	'remove-course-page',
	'reset-course',
	'restore-runs',
	'trash-runs',
].map( ( name ) => `${ NAMESPACE }/${ name }` );

/** Query parameters of a read-only ability call, with list values repeated as `input[key][]`. */
type Input = Record< string, string | number | string[] >;

let api: APIRequestContext;
let originalCourse: unknown;

let measuredId: number; // finished, 9.5 %/h
let fasterId: number; // finished, 12.5 %/h
let failedId: number; // failed, unmeasured
let pageId: number; // published page
let draftId: number; // draft page
let privateId: number; // private page

/**
 * Builds the meta record of a seeded run, in the shape the cockpit uploads.
 *
 * @param overrides - Fields that differ from a measured, finished duration run.
 * @return The run's meta.
 */
function runMeta( overrides: Record< string, unknown > ) {
	return {
		bsbench_status: 'finished',
		bsbench_mode: 'duration',
		bsbench_config_mode: 'duration',
		bsbench_config_duration: 1800,
		bsbench_started_at: '2026-11-20T09:00:00.000Z',
		bsbench_ended_at: '2026-11-20T09:30:00.000Z',
		bsbench_start_level: 0.91,
		bsbench_end_level: 0.86,
		bsbench_dropped_pct: 5,
		bsbench_elapsed: 1800,
		bsbench_rate_10: 9.8,
		bsbench_rate_session: 9.5,
		bsbench_time_to_empty: 37895,
		bsbench_ua_browser: BROWSER,
		bsbench_ua_version: '142',
		bsbench_ua_os: 'macOS',
		bsbench_samples: [
			{ t: 0, level: 0.91, charging: false, count: 1 },
			{ t: 600000, level: 0.86, charging: false, count: 3 },
		],
		...overrides,
	};
}

/**
 * Creates a record over a collection and returns its id.
 *
 * @param route - The collection route.
 * @param data  - The body to post.
 * @return The new record's id.
 */
async function create( route: string, data: unknown ): Promise< number > {
	const response = await api.post( route, { data } );
	expect( response.status() ).toBe( 201 );

	return ( await response.json() ).id as number;
}

/**
 * Builds an ability's URL.
 *
 * @param name  - The ability's short name.
 * @param input - Query input for a read-only or destructive ability.
 * @return The URL of the ability's run route.
 */
function runUrl( name: string, input: Input = {} ): string {
	const query = new URLSearchParams();

	for ( const [ key, value ] of Object.entries( input ) ) {
		for ( const item of Array.isArray( value ) ? value : [ value ] ) {
			query.append(
				Array.isArray( value )
					? `input[${ key }][]`
					: `input[${ key }]`,
				String( item )
			);
		}
	}

	return `${ ABILITIES }/${ NAMESPACE }/${ name }/run?${ query }`;
}

/**
 * Runs a read-only ability over GET.
 *
 * @param name  - The ability's short name.
 * @param input - The input, as query parameters.
 * @return The response.
 */
function read( name: string, input: Input = {} ): Promise< APIResponse > {
	return api.get( runUrl( name, input ) );
}

/**
 * Runs an ability that changes things over POST.
 *
 * @param name  - The ability's short name.
 * @param input - The input, as the JSON body's `input`.
 * @return The response.
 */
function write( name: string, input: unknown ): Promise< APIResponse > {
	return api.post( runUrl( name ), { data: { input } } );
}

test.describe.configure( { mode: 'serial' } );

test.describe( 'AI agent abilities', () => {
	test.beforeAll( async ( { playwright, baseURL } ) => {
		const session = await playwright.request.newContext( {
			baseURL,
			storageState: ADMIN_STORAGE_STATE,
		} );
		const nonce = (
			await (
				await session.get(
					'/wp-admin/admin-ajax.php?action=rest-nonce'
				)
			).text()
		).trim();
		await session.dispose();

		api = await playwright.request.newContext( {
			baseURL,
			storageState: ADMIN_STORAGE_STATE,
			extraHTTPHeaders: { 'X-WP-Nonce': nonce },
		} );

		const settings = await api.get( '/wp-json/wp/v2/settings' );
		originalCourse = ( await settings.json() ).bsbench_course_order;

		const sessions = '/wp-json/wp/v2/bsbench_session';
		measuredId = await create( sessions, {
			status: 'publish',
			meta: runMeta( { bsbench_started_at: '2026-11-20T09:00:00.000Z' } ),
		} );
		fasterId = await create( sessions, {
			status: 'publish',
			meta: runMeta( {
				bsbench_started_at: '2026-11-21T09:00:00.000Z',
				bsbench_rate_session: 12.5,
				bsbench_rate_10: 12.9,
				bsbench_time_to_empty: 28800,
			} ),
		} );
		failedId = await create( sessions, {
			status: 'publish',
			meta: runMeta( {
				bsbench_status: 'failed',
				bsbench_started_at: '2026-11-22T09:00:00.000Z',
				bsbench_rate_session: 0,
				bsbench_rate_10: 0,
				bsbench_time_to_empty: 0,
			} ),
		} );

		pageId = await create( '/wp-json/wp/v2/pages', {
			title: 'E2E Agent Page',
			status: 'publish',
		} );
		draftId = await create( '/wp-json/wp/v2/pages', {
			title: 'E2E Agent Draft',
			status: 'draft',
		} );
		privateId = await create( '/wp-json/wp/v2/pages', {
			title: 'E2E Agent Private',
			status: 'private',
		} );
	} );

	test.afterAll( async () => {
		await api.post( '/wp-json/wp/v2/settings', {
			data: { bsbench_course_order: originalCourse },
		} );

		for ( const route of [
			...[ measuredId, fasterId, failedId ].map(
				( id ) => `/wp-json/wp/v2/bsbench_session/${ id }`
			),
			...[ pageId, draftId, privateId ].map(
				( id ) => `/wp-json/wp/v2/pages/${ id }`
			),
		] ) {
			await api.delete( `${ route }?force=true` );
		}

		await api.dispose();
	} );

	test( 'lists exactly the 14 abilities of the plugin', async () => {
		const response = await api.get(
			`${ ABILITIES }?category=${ NAMESPACE }&per_page=100`
		);
		expect( response.status() ).toBe( 200 );

		const names = ( await response.json() ).map(
			( ability: { name: string } ) => ability.name
		);
		expect( names.sort() ).toEqual( [ ...ABILITY_NAMES ].sort() );
	} );

	test( 'list-runs orders by drain rate, with the unmeasured run last', async () => {
		const response = await read( 'list-runs', {
			browser: BROWSER,
			order_by: 'drain_rate_session',
		} );
		expect( response.status() ).toBe( 200 );

		const result = await response.json();
		expect( result.total ).toBe( 3 );
		expect( result.returned ).toBe( 3 );
		expect(
			result.runs.map(
				( run: { drain_rate_session_pct_per_hour: number | null } ) =>
					run.drain_rate_session_pct_per_hour
			)
		).toEqual( [ 12.5, 9.5, null ] );
		expect( result.runs.map( ( run: { id: number } ) => run.id ) ).toEqual(
			[ fasterId, measuredId, failedId ]
		);
		// A listed run keeps its setup but not its reading count.
		expect( result.runs[ 0 ].setup ).toEqual( {
			duration_seconds: 1800,
			stop_at_battery_percent: null,
		} );
		expect( result.runs[ 0 ] ).not.toHaveProperty( 'reading_count' );
	} );

	test( 'get-run reads a run back as percentages, nulls and a report link', async () => {
		const measured = await (
			await read( 'get-run', { id: measuredId } )
		).json();

		expect( measured.id ).toBe( measuredId );
		expect( measured.status ).toBe( 'finished' );
		expect( measured.end_reason ).toBe( 'duration' );
		expect( measured.battery_start_percent ).toBe( 91 );
		expect( measured.battery_end_percent ).toBe( 86 );
		expect( measured.battery_drop_points ).toBe( 5 );
		expect( measured.drain_rate_session_pct_per_hour ).toBe( 9.5 );
		expect( measured.projected_full_runtime_seconds ).toBe( 37895 );
		expect( measured.setup ).toEqual( {
			duration_seconds: 1800,
			stop_at_battery_percent: null,
		} );
		expect( measured.browser ).toEqual( {
			name: BROWSER,
			version: '142',
			os: 'macOS',
		} );
		expect( measured.reading_count ).toBe( 2 );
		expect( measured.report_url ).toContain( 'page=bsbench-session' );
		expect( measured.report_url ).toContain( String( measuredId ) );

		const failed = await (
			await read( 'get-run', { id: failedId } )
		).json();

		expect( failed.end_reason ).toBe( 'loadError' );
		expect( failed.drain_rate_session_pct_per_hour ).toBeNull();
		expect( failed.projected_full_runtime_seconds ).toBeNull();
	} );

	test( 'get-drain-stats averages the measured runs and lists the unmeasured one', async () => {
		const response = await read( 'get-drain-stats', {
			browser: BROWSER,
			status: [ 'finished', 'failed' ],
		} );
		expect( response.status() ).toBe( 200 );

		const stats = await response.json();
		expect( stats.runs_matched ).toBe( 3 );
		expect( stats.runs_measured ).toBe( 2 );
		expect( stats.unmeasured_run_ids ).toEqual( [ failedId ] );
		expect( stats.average_drain_rate_session_pct_per_hour ).toBe( 11 );
		expect( stats.fastest_drain.id ).toBe( fasterId );
		expect( stats.slowest_drain.id ).toBe( measuredId );
	} );

	test( 'get-run-readings returns the readings in seconds', async () => {
		const result = await (
			await read( 'get-run-readings', { id: measuredId } )
		).json();

		expect( result.reading_count ).toBe( 2 );
		expect( result.readings[ 1 ] ).toEqual( {
			elapsed_seconds: 600,
			battery_percent: 86,
			charging: false,
			repeat_count: 3,
		} );
	} );

	test( 'compare-runs keeps the order it was given', async () => {
		const result = await (
			await read( 'compare-runs', {
				ids: [ String( fasterId ), String( measuredId ) ],
			} )
		).json();

		expect( result.runs.map( ( run: { id: number } ) => run.id ) ).toEqual(
			[ fasterId, measuredId ]
		);
	} );

	test( 'the course can be searched, added to, reordered, trimmed and reset', async () => {
		const found = await (
			await read( 'find-pages', { search: 'E2E Agent' } )
		).json();
		const byId = ( id: number ) =>
			found.pages.find(
				( page: { post_id: number } ) => page.post_id === id
			);

		expect( byId( pageId ).can_add ).toBe( true );
		expect( byId( pageId ).reason ).toBeNull();
		expect( byId( draftId ).can_add ).toBe( false );
		expect( byId( draftId ).reason ).toContain( 'its status is draft' );
		// A private page is listed under its plain title and refused as private.
		expect( byId( privateId ).title ).toBe( 'E2E Agent Private' );
		expect( byId( privateId ).can_add ).toBe( false );
		expect( byId( privateId ).reason ).toContain( "because it's private" );

		const added = await write( 'add-course-page', {
			post_id: pageId,
			position: 1,
		} );
		expect( added.status() ).toBe( 200 );

		const course = await added.json();
		expect( course.pages[ 0 ].post_id ).toBe( pageId );
		expect( course.added.position ).toBe( 1 );
		expect( course.is_default ).toBe( false );

		const refused = await write( 'add-course-page', { post_id: draftId } );
		expect( refused.status() ).toBe( 400 );
		expect( ( await refused.json() ).code ).toBe(
			'bsbench_page_not_published'
		);

		const refusedPrivate = await write( 'add-course-page', {
			post_id: privateId,
		} );
		expect( refusedPrivate.status() ).toBe( 400 );
		expect( ( await refusedPrivate.json() ).code ).toBe(
			'bsbench_page_private'
		);

		const moved = await (
			await write( 'move-course-page', {
				post_id: pageId,
				position: course.page_count,
			} )
		).json();
		expect( moved.pages[ moved.page_count - 1 ].post_id ).toBe( pageId );

		const removed = await (
			await write( 'remove-course-page', { post_id: pageId } )
		).json();
		expect(
			removed.pages.some(
				( page: { post_id: number | null } ) => page.post_id === pageId
			)
		).toBe( false );

		const reset = await api.delete( runUrl( 'reset-course' ) );
		expect( reset.status() ).toBe( 200 );
		expect( ( await reset.json() ).is_default ).toBe( true );
	} );

	test( 'get-cockpit-link points at the cockpit and the Sessions screen', async () => {
		const result = await ( await read( 'get-cockpit-link' ) ).json();

		expect( result.cockpit_url ).toContain( 'bsbenchSession=cockpit' );
		expect( result.sessions_url ).toContain( 'page=bsbench-sessions' );
		expect( result.requirements ).toHaveLength( 4 );
	} );

	test( 'trash-runs moves a run to the trash, and restore-runs brings it back', async () => {
		const trashed = await write( 'trash-runs', { ids: [ failedId ] } );
		expect( trashed.status() ).toBe( 200 );
		expect( ( await trashed.json() ).trashed_count ).toBe( 1 );

		const gone = await read( 'get-run', { id: failedId } );
		expect( gone.status() ).toBe( 404 );
		expect( ( await gone.json() ).code ).toBe( 'bsbench_run_not_found' );

		// The trashed run is listed with in_trash, and only then.
		const inTrash = await (
			await read( 'list-runs', { in_trash: 'true', browser: BROWSER } )
		).json();
		expect( inTrash.runs.map( ( run: { id: number } ) => run.id ) ).toEqual(
			[ failedId ]
		);

		const restored = await write( 'restore-runs', { ids: [ failedId ] } );
		expect( restored.status() ).toBe( 200 );

		const back = await ( await restored.json() ).restored;
		expect( back[ 0 ].id ).toBe( failedId );

		// Restored to published, not to a draft: it reads again as a recorded run.
		const again = await read( 'get-run', { id: failedId } );
		expect( again.status() ).toBe( 200 );
		expect( ( await again.json() ).status ).toBe( 'failed' );

		const refused = await write( 'restore-runs', { ids: [ failedId ] } );
		expect( refused.status() ).toBe( 404 );
		expect( ( await refused.json() ).code ).toBe(
			'bsbench_restore_not_found'
		);
	} );

	test( 'an MCP client can discover and run an ability through the MCP Adapter', async () => {
		const headers = {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
		};
		const rpc = ( data: unknown, extra: Record< string, string > = {} ) =>
			api.post( MCP_ENDPOINT, {
				headers: { ...headers, ...extra },
				data,
			} );

		const initialized = await rpc( {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-06-18',
				capabilities: {},
				clientInfo: { name: 'e2e', version: '1.0.0' },
			},
		} );
		expect( initialized.status() ).toBe( 200 );

		const session = initialized.headers()[ 'mcp-session-id' ];
		expect( session ).toBeTruthy();
		const withSession = { 'Mcp-Session-Id': session };

		await rpc(
			{ jsonrpc: '2.0', method: 'notifications/initialized' },
			withSession
		);

		const discovered = await (
			await rpc(
				{
					jsonrpc: '2.0',
					id: 2,
					method: 'tools/call',
					params: {
						name: 'mcp-adapter-discover-abilities',
						arguments: {},
					},
				},
				withSession
			)
		).json();
		expect( JSON.stringify( discovered ) ).toContain(
			`${ NAMESPACE }/get-run`
		);

		const executed = await (
			await rpc(
				{
					jsonrpc: '2.0',
					id: 3,
					method: 'tools/call',
					params: {
						name: 'mcp-adapter-execute-ability',
						arguments: {
							ability_name: `${ NAMESPACE }/get-run`,
							parameters: { id: measuredId },
						},
					},
				},
				withSession
			)
		).json();
		const text = executed.result.content[ 0 ].text as string;
		// The adapter wraps an ability's result as `{ success, data }`.
		expect( JSON.parse( text ) ).toMatchObject( {
			success: true,
			data: { id: measuredId },
		} );

		const closed = await api.delete( MCP_ENDPOINT, {
			headers: withSession,
		} );
		expect( closed.status() ).toBeLessThan( 300 );
	} );
} );
