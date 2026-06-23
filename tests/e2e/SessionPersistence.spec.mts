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
		bsb_rate_10: 24.5,
		bsb_rate_session: 0,
		bsb_seconds_to_empty: 0,
		bsb_config_mode: 'targetDrop',
		bsb_config_duration_minutes: 30,
		bsb_config_baseline: true,
		bsb_config_target_percent: 70,
		bsb_ua: 'Mozilla/5.0 (Playwright) BatterySurfBench/1.0',
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

		const fetched = await page.request.get( `${ COLLECTION }/${ id }` );
		expect( fetched.ok() ).toBeTruthy();
		const { meta } = await fetched.json();

		// Identity and result scalars round-trip.
		expect( meta.bsb_status ).toBe( 'finished' );
		expect( meta.bsb_mode ).toBe( 'target' );
		expect( meta.bsb_dropped_pct ).toBe( 12 );

		// The configuration persists under its namespaced keys, the uppercase in
		// `targetDrop` intact (a `sanitize_key` would have mangled it).
		expect( meta.bsb_config_mode ).toBe( 'targetDrop' );
		expect( meta.bsb_config_baseline ).toBe( true );
		expect( meta.bsb_config_target_percent ).toBe( 70 );

		// The user agent the run was captured on persists.
		expect( meta.bsb_ua ).toBe(
			'Mozilla/5.0 (Playwright) BatterySurfBench/1.0'
		);

		// A statistic the run could not compute is stored as zero (WordPress REST
		// single meta cannot hold a null), and round-trips intact.
		expect( meta.bsb_rate_session ).toBe( 0 );
		expect( meta.bsb_seconds_to_empty ).toBe( 0 );

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
