import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the stored-session detail screen.
 *
 * A session opens to its run-summary postcard on its own native admin edit
 * screen: the `replace_editor` route swaps the block editor for the postcard
 * while the admin chrome renders around it. This proves that flow against the
 * WordPress version the plugin runs on — the postcard mounts and hydrates from
 * the stored meta (the verdict the store derives from the seeded run reason),
 * and the admin header and menu render intact, which guards the regression
 * where rendering on the early WP_Screen pass output before the chrome was
 * ready. The blueprint enables WP_DEBUG_DISPLAY, so a PHP notice prints into the
 * page and fails the test — the headers-sent / null-post warnings that the early
 * pass produced would surface here.
 */

const COLLECTION = '/wp-json/wp/v2/bsb_session';

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE =
	/Warning:|Notice:|Deprecated:|Fatal error:|headers already sent/;

/** A finished target-drop run, enough for the summary to derive its verdict. */
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
		bsb_rate_session: 18,
		bsb_time_to_empty: 18000,
		bsb_config_mode: 'targetDrop',
		bsb_config_target_percent: 70,
		bsb_samples: [
			{ t: 0, level: 0.82, charging: false, count: 1 },
			{ t: 600000, level: 0.7, charging: false, count: 3 },
		],
	},
};

test.describe( 'Stored-session detail screen', () => {
	test( 'renders the summary postcard on the native edit screen, no PHP notices', async ( {
		page,
	} ) => {
		const consoleErrors: string[] = [];
		page.on( 'console', ( message ) => {
			if ( message.type() === 'error' ) {
				consoleErrors.push( message.text() );
			}
		} );
		page.on( 'pageerror', ( error ) => {
			consoleErrors.push( error.message );
		} );

		// Seed a session through the post type's own REST collection, the way the
		// cockpit uploads a finished run.
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
		const id = ( await created.json() ).id as number;

		// Open the session at its native admin edit URL — the flow a listing row
		// click follows.
		await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );

		// The admin chrome renders around the custom display: a half-built header
		// (the early-pass regression) would drop these.
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible();
		await expect( page.locator( '#adminmenu' ) ).toBeVisible();

		// The detail wrapper and the summary postcard mount.
		await expect( page.locator( '.bsb-session-detail' ) ).toBeVisible();
		await expect( page.locator( '.bsb-summary' ) ).toBeVisible();

		// The store hydrates and derives the verdict from the seeded run reason: a
		// finished target-drop run reads "Target reached." Its presence proves the
		// view module loaded and the context seeding round-tripped.
		await expect( page.locator( '.bsb-summary__head' ) ).toHaveText(
			'Target reached.'
		);

		// The frozen battery readout round-trips from the stored levels (82 → 70).
		await expect( page.locator( '.bsb-stat__value--arrow' ) ).toContainText(
			'82'
		);
		await expect( page.locator( '.bsb-stat__value--arrow' ) ).toContainText(
			'70'
		);

		// The drain graph is rebuilt client-side from the seeded samples.
		await expect( page.locator( '.bsb-summary__graph' ) ).toBeVisible();

		// Regression guard: the card must NOT inherit wp-admin's global
		// `line-height: 1.4em` (a fixed ~18px length at the 13px admin base). That
		// bloated the stat rows until they collided with the absolutely-positioned
		// flip/back corner — the live cockpit escapes it only because the front end
		// dequeues every WP/theme stylesheet. The detail wrapper resets it to the
		// browser default, so the stat rows stay compact and clear the corner.
		const statLineHeight = await page
			.locator( '.bsb-session-detail .bsb-summary__stats .bsb-stat' )
			.first()
			.evaluate( ( el ) => getComputedStyle( el ).lineHeight );
		expect( statLineHeight ).toBe( 'normal' );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
		expect( consoleErrors ).toEqual( [] );
	} );
} );
