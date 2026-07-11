import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for persisting a benchmark session over REST.
 *
 * The cockpit uploads a finished run by POSTing a `bsb_session` to the post
 * type's own `wp/v2` collection — there is no bespoke controller. This proves
 * that consumed contract against the WordPress version the plugin runs on: an
 * authenticated administrator can create a session carrying the full meta record
 * (the run configuration under the `config_*` keys, the derived statistics —
 * zero standing in for what a run could not compute — and the typed sample log),
 * read it back with every meta intact, and that the collection is gated — an
 * unauthenticated request cannot create one. The blueprint enables
 * WP_DEBUG_DISPLAY, so a PHP notice in the REST response would surface as
 * malformed JSON and fail the round-trip.
 */

const COLLECTION = '/wp-json/wp/v2/bsb_session';

/** A representative finished-run record, matching the cockpit's upload shape. */
const sessionBody = {
	status: 'publish',
	meta: {
		bsb_status: 'finished',
		bsb_mode: 'target',
		bsb_started_at: '2026-06-23T10:00:00.000Z',
		bsb_ended_at: '2026-06-23T10:30:00.000Z',
		bsb_start_level: 0.82,
		bsb_end_level: 0.7,
		bsb_dropped_pct: 12,
		bsb_elapsed: 1623,
		bsb_rate_10: 24.5,
		bsb_rate_session: 0,
		bsb_time_to_empty: 0,
		bsb_config_mode: 'targetDrop',
		// A target-drop run records only its target, not a fixed duration.
		bsb_config_target_percent: 70,
		bsb_ua_browser: 'Chrome',
		bsb_ua_version: '149',
		bsb_ua_os: 'macOS',
		bsb_samples: [
			{ t: 0, level: 0.82, charging: false, count: 1 },
			{ t: 600000, level: 0.7, charging: false, count: 3 },
		],
	},
};

test.describe( 'Benchmark session persistence', () => {
	test( 'an admin can create and read back a session with full meta', async ( {
		page,
	} ) => {
		// The canonical way to mint a wp_rest nonce for the logged-in user; the
		// cookie auth on the stored admin session then authorises the write.
		const nonce = (
			await (
				await page.request.get(
					'/wp-admin/admin-ajax.php?action=rest-nonce'
				)
			).text()
		).trim();

		const created = await page.request.post( COLLECTION, {
			headers: { 'X-WP-Nonce': nonce },
			data: sessionBody,
		} );
		expect( created.status() ).toBe( 201 );

		const record = await created.json();
		const id = record.id as number;
		expect( id ).toBeGreaterThan( 0 );

		// The read-back also needs the nonce: WordPress's cookie-auth layer
		// (`rest_cookie_check_errors()`) treats a nonce-less REST request as
		// anonymous even over a valid session, so SessionRestController's
		// capability gate — correctly — would otherwise refuse this GET too.
		const fetched = await page.request.get( `${ COLLECTION }/${ id }`, {
			headers: { 'X-WP-Nonce': nonce },
		} );
		expect( fetched.ok() ).toBeTruthy();
		const { meta } = await fetched.json();

		// Identity and result scalars round-trip.
		expect( meta.bsb_status ).toBe( 'finished' );
		expect( meta.bsb_mode ).toBe( 'target' );
		expect( meta.bsb_dropped_pct ).toBe( 12 );
		expect( meta.bsb_elapsed ).toBe( 1623 );

		// The configuration persists under its namespaced keys, the uppercase in
		// `targetDrop` intact (a `sanitize_key` would have mangled it).
		expect( meta.bsb_config_mode ).toBe( 'targetDrop' );
		expect( meta.bsb_config_target_percent ).toBe( 70 );
		// A target-drop run records no fixed duration, so it reads back as the
		// not-applicable zero.
		expect( meta.bsb_config_duration ).toBe( 0 );

		// The discrete browser fields the run was captured on persist.
		expect( meta.bsb_ua_browser ).toBe( 'Chrome' );
		expect( meta.bsb_ua_version ).toBe( '149' );
		expect( meta.bsb_ua_os ).toBe( 'macOS' );

		// A statistic the run could not compute is stored as zero (WordPress REST
		// single meta cannot hold a null), and round-trips intact.
		expect( meta.bsb_rate_session ).toBe( 0 );
		expect( meta.bsb_time_to_empty ).toBe( 0 );

		// The typed sample log survives schema validation whole.
		expect( meta.bsb_samples ).toHaveLength( 2 );
		expect( meta.bsb_samples[ 1 ].level ).toBeCloseTo( 0.7 );
		expect( meta.bsb_samples[ 1 ].count ).toBe( 3 );
	} );

	test( 'an unauthenticated request cannot create a session', async ( {
		playwright,
		baseURL,
	} ) => {
		const anon = await playwright.request.newContext( { baseURL } );

		const denied = await anon.post( COLLECTION, { data: sessionBody } );
		expect( denied.status() ).toBe( 401 );

		await anon.dispose();
	} );
} );
