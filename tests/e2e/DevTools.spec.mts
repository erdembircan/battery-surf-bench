import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the dev-tools battery-override panel.
 *
 * The e2e blueprint runs with `WP_ENVIRONMENT_TYPE: 'development'`, so the
 * dev-tools gate is open: the floating panel and its script module load on the
 * cockpit dashboard, the same surface a live run happens on (the panel binds
 * only to shared `bsb/cockpit` state, never cockpit context, so it works
 * exactly the same whichever course page the viewport happens to be surfing).
 * The blueprint enables `WP_DEBUG_DISPLAY`, so a PHP notice prints into the
 * page and fails these tests.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/**
 * Flips the startup postcard and starts a run in the default (duration) mode.
 *
 * @param page - The page to act on.
 */
async function startRun( page: Page ): Promise< void > {
	await page
		.locator(
			'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
		)
		.first()
		.click();
	await page
		.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
		.click();
}

test.describe( 'Dev-tools battery-override panel', () => {
	test( 'the pill and card are mutually exclusive, collapsed by default', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await expect( page.locator( '.bsb-devtools' ) ).toBeAttached();

		// Closed: the pill is on screen, the card is not.
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeHidden();

		await page.locator( '.bsb-devtools__pill' ).click();

		// Open: the swap, never both — the pill is now hidden, the card visible.
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeHidden();

		await page.locator( '.bsb-devtools__card-close' ).click();

		// Closing swaps back.
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'expanding the panel arms the battery section', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeVisible();

		const groupBody = page.locator( '.bsb-devtools__group-body' );
		await expect( groupBody ).toHaveClass( /is-muted/ );

		await page
			.locator( '.bsb-devtools__group input[type="checkbox"]' )
			.first()
			.click();
		await expect( groupBody ).not.toHaveClass( /is-muted/ );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'an override in effect arms the pill and shows the card header text — enabling alone does not', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();
		const armedText = page.locator( '.bsb-devtools__card-armed' );

		// Enabling the sub-tool alone is not "armed" — both fields still follow
		// the system, so nothing is actually overridden yet.
		await page
			.locator( '.bsb-devtools__group input[type="checkbox"]' )
			.first()
			.click();
		await expect( armedText ).toBeHidden();

		// Forcing a charging choice is what arms it.
		await page.locator( '[data-devtools-charging="discharging"]' ).click();
		await expect( armedText ).toBeVisible();
		await expect( armedText ).toHaveText( 'Override active' );

		// Collapse and confirm the pill itself picked up the armed styling.
		await page.locator( '.bsb-devtools__card-close' ).click();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toHaveClass(
			/is-armed/
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'forcing Discharging lets a run start and keep surfing, forcing Charging stops it with the plugged reason', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// Open the panel and arm the battery sub-tool.
		await page.locator( '.bsb-devtools__pill' ).click();
		await page
			.locator( '.bsb-devtools__group input[type="checkbox"]' )
			.first()
			.click();

		// Force discharging so a run can start (and keep running) regardless of
		// whatever the host machine actually reports — the exact friction this
		// tool removes.
		await page.locator( '[data-devtools-charging="discharging"]' ).click();
		await expect(
			page.locator( '[data-devtools-charging="discharging"]' )
		).toHaveClass( /is-selected/ );

		await startRun( page );

		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeVisible();
		await expect(
			page.locator( 'iframe.bsb-cockpit__viewport' )
		).toHaveAttribute( 'src', /bsbSessionPage/ );

		// The run keeps surfing — it is not immediately undone by the host's own
		// real charging state.
		await page.waitForTimeout( 500 );
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeVisible();
		await expect( page.locator( '.bsb-summary' ) ).toBeHidden();

		// Forcing charging re-applies immediately (no reload, no waiting for the
		// next real battery event) and stops the run with the plugged reason.
		await page.locator( '[data-devtools-charging="charging"]' ).click();

		await expect( page.locator( '.bsb-summary' ) ).toBeVisible();
		await expect( page.locator( '.bsb-summary__head' ) ).toHaveText(
			'Plugged back in.'
		);
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a persisted level override positions the slider thumb after a reload', async ( {
		page,
	} ) => {
		// Seed the persisted devtools slice before any module runs, as a prior
		// session would have left it.
		await page.addInitScript( () => {
			window.localStorage.setItem(
				'bsb-devtools-v1',
				JSON.stringify( {
					open: true,
					battery: { enabled: true, charging: null, level: 0.3 },
				} )
			);
		} );

		await page.goto( '/?bsbSession=cockpit' );

		// Pins the range input's `data-wp-bind--value` behavior: under the
		// installed Interactivity version the binding sets the input's value
		// PROPERTY (which positions the thumb), so the slider must sit at the
		// persisted 30 — not the browser-default 50 — while the readout span
		// shows the same figure. If a future Interactivity version regresses
		// this to an attribute-only (no-op) bind, this assertion catches it.
		const slider = page.locator(
			'.bsb-devtools__level input[type="range"]'
		);
		await expect( slider ).toHaveValue( '30' );
		await expect( page.locator( '.bsb-devtools__level-value' ) ).toHaveText(
			'30%'
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the panel also loads on the stored-session detail screen', async ( {
		page,
	} ) => {
		const nonce = (
			await (
				await page.request.get(
					'/wp-admin/admin-ajax.php?action=rest-nonce'
				)
			).text()
		).trim();
		const created = await page.request.post( '/wp-json/wp/v2/bsb_session', {
			headers: { 'X-WP-Nonce': nonce },
			data: {
				status: 'publish',
				meta: {
					bsb_status: 'finished',
					bsb_mode: 'duration',
					bsb_started_at: '2026-06-23T10:00:00.000Z',
					bsb_ended_at: '2026-06-23T10:30:00.000Z',
					bsb_start_level: 0.9,
					bsb_end_level: 0.8,
					bsb_dropped_pct: 10,
					bsb_elapsed: 1800,
					bsb_config_mode: 'duration',
				},
			},
		} );
		expect( created.status() ).toBe( 201 );
		const id = ( await created.json() ).id as number;

		await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );

		await expect( page.locator( '.bsb-devtools' ) ).toBeAttached();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
