import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the dev-tools panel's Surf group: arming the
 * "Sterile" override, starting a run under it (the auction never ticks), and
 * firing behaviors manually from the panel to observe them on the live page.
 *
 * The e2e blueprint runs with `WP_ENVIRONMENT_TYPE: 'development'`, so the
 * dev-tools gate is open, and with `WP_DEBUG_DISPLAY`, so a PHP notice prints
 * into the page and fails these tests.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/**
 * Forces discharging through the dev-tools panel (so a run can start
 * regardless of the host's real battery/charging state — the same seam every
 * other cockpit e2e spec that needs a live run already uses).
 *
 * @param page - The page to act on.
 */
async function forceDischarging( page: Page ): Promise< void > {
	await page.locator( '.bsb-devtools__pill' ).click();
	await page.locator( '[data-devtools-charging="discharging"]' ).click();
}

/**
 * Arms the dev-tools Surf tool's "Sterile" override. Assumes the panel card
 * is already open.
 *
 * @param page - The page to act on.
 */
async function armSterile( page: Page ): Promise< void > {
	await page.locator( '[data-devtools-surf-mode="sterile"]' ).click();
}

/**
 * Flips the startup postcard, selects the 4× demo speed (fast enough that an
 * announced dwell resolves well inside this spec's assertion timeouts, but —
 * unlike 10×, whose ~0.8-2s readPause dwell leaves the bark-attribute and
 * disabled-state assertions racing a narrow window — still comfortable: a
 * readPause dwell of ~2-5s), and starts a run. Assumes the dev-tools card has
 * already been closed.
 *
 * @param page - The page to act on.
 */
async function startFastRun( page: Page ): Promise< void > {
	await page
		.locator(
			'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
		)
		.first()
		.click();
	await page
		.locator( '.bsb-seg--speed .bsb-seg__option[data-speed="4"]' )
		.click();
	await page
		.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
		.click();
}

test.describe( 'Dev-tools Surf group', () => {
	test( 'arming Sterile selects the seg option in coral and reports the panel armed', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		const natural = page.locator( '[data-devtools-surf-mode="natural"]' );
		const sterile = page.locator( '[data-devtools-surf-mode="sterile"]' );
		const armedText = page.locator( '.bsb-devtools__card-armed' );

		await expect( natural ).toHaveClass( /is-selected/ );
		await expect( sterile ).not.toHaveClass( /is-selected/ );
		await expect( armedText ).toBeHidden();

		await sterile.click();

		await expect( sterile ).toHaveClass( /is-selected/ );
		await expect( natural ).not.toHaveClass( /is-selected/ );
		await expect( armedText ).toBeVisible();

		// Collapsing and re-reading the pill confirms the armed tie-in, the
		// same regression guard the battery/discharge tools already carry.
		await page.locator( '.bsb-devtools__card-close' ).click();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toHaveClass(
			/is-armed/
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a sterile run shows the topbar chip, enables chips once affordances arrive, gates a chip lacking its affordance, steers a behavior (bark + disables while running), and the page stepper navigates', async ( {
		page,
	} ) => {
		test.setTimeout( 60_000 );

		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await armSterile( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );

		// The run is live and sterile: the compact topbar's status head shows
		// the "Sterile" chip.
		const viewport = page.locator( 'iframe.bsb-cockpit__viewport' );
		await expect( viewport ).toHaveAttribute( 'src', /bsbSterile=1/ );
		await expect(
			page.locator( '.bsb-cockpit__topbar .bsb-deck__sterile-chip' )
		).toBeVisible();

		// The panel was closed before the run started; reopen it to reach the
		// chips (the message listener that gates them stays attached
		// regardless — only the card's own visibility toggles).
		await page.locator( '.bsb-devtools__pill' ).click();

		// The Natural/Sterile seg is snapshotted only at run start, so toggling
		// it mid-run would be a lie: both options lock while any run is live.
		const sterileSeg = page.locator(
			'[data-devtools-surf-mode="sterile"]'
		);
		await expect(
			page.locator( '[data-devtools-surf-mode="natural"]' )
		).toBeDisabled();
		await expect( sterileSeg ).toBeDisabled();

		// A disabled seg still shows which choice is active: locking the seg
		// must never make the run's own already-armed Sterile choice look
		// deselected.
		await expect( sterileSeg ).toHaveClass( /is-selected/ );
		await expect( sterileSeg ).toBeVisible();

		// The chips start disabled (no affordances yet) and enable once the
		// sterile page posts them at readiness.
		const scrollBurstChip = page.locator(
			'[data-devtools-behavior="scrollBurst"]'
		);
		await expect( scrollBurstChip ).toBeEnabled( { timeout: 15_000 } );

		// article-1 (the first bundled page) has no video, so watchVideo's own
		// hard affordance gate keeps it disabled even though the panel is
		// otherwise live.
		await expect(
			page.locator( '[data-devtools-behavior="watchVideo"]' )
		).toBeDisabled();

		// Steer readPause: the bark pill appears carrying its key, and the
		// chip disables while it runs (the sequential guard covers every
		// other chip too, asserted via scrollBurst).
		const readPauseChip = page.locator(
			'[data-devtools-behavior="readPause"]'
		);
		await readPauseChip.click();

		await expect( page.locator( '.bsb-cockpit__bark' ) ).toHaveAttribute(
			'data-bark',
			'readPause'
		);
		await expect( readPauseChip ).toBeDisabled();
		await expect( scrollBurstChip ).toBeDisabled();

		// Wait for the steered behavior to resolve (bsb:behaviorEnd), which
		// re-enables every chip.
		await expect( readPauseChip ).toBeEnabled( { timeout: 15_000 } );

		// The page stepper navigates the viewport: clicking next advances the
		// opaque course index from 0 to 1. The readout mirrors the real
		// course-page slug the server resolves that index against (the
		// bundled catalog's default order: article-1, gallery, article-2,
		// video, links) — never a glyph or the raw index.
		const slugReadout = page.locator(
			'.bsb-devtools__stepper-readout--slug'
		);
		await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex=0/ );
		await expect( slugReadout ).toHaveText( 'article-1' );
		await page.locator( '[aria-label="Next course page"]' ).click();
		await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex=1/ );
		await expect( slugReadout ).toHaveText( 'gallery' );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
