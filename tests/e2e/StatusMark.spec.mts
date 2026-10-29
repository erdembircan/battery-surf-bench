import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the cockpit's live-run status mark: the sunburst
 * that opens the status line while a run is live. A natural run shows it sun
 * yellow and turning at a pace set by the demo speed, with no glow; a sterile
 * run turns it coral; reduced motion holds it still.
 *
 * The e2e blueprint runs with `WP_ENVIRONMENT_TYPE: 'development'`, so the
 * dev-tools gate is open, and with `WP_DEBUG_DISPLAY`, so a PHP notice prints
 * into the page and fails these tests.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/**
 * Forces discharging through the dev-tools panel, so a run can start
 * regardless of the host's real battery and charging state.
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
 * Flips the startup postcard, selects the 4× demo speed and starts a run.
 * Assumes the dev-tools card has already been closed.
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

/**
 * Reads the mask image the browser paints the mark with, from the unprefixed
 * property or, failing that, the `-webkit-` one.
 *
 * @param mark - The status mark to inspect.
 * @return The computed mask image value.
 */
async function maskImageOf( mark: Locator ): Promise< string > {
	return mark.evaluate( ( element ) => {
		const style = getComputedStyle( element );

		return style.maskImage || style.webkitMaskImage;
	} );
}

test.describe( 'Status mark', () => {
	test( 'a natural run turns a sun-yellow sunburst at the demo speed, with no glow', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );

		const mark = page.locator(
			'.bsb-cockpit__topbar .bsb-deck__status-mark'
		);
		await expect( mark ).toBeVisible();
		await expect( mark ).toHaveCSS( 'animation-name', 'bsb-sunburst-turn' );
		// 36s divided by the square root of the 4× demo speed.
		await expect( mark ).toHaveCSS( 'animation-duration', '18s' );
		await expect( mark ).toHaveCSS(
			'background-color',
			'rgb(255, 206, 92)'
		);
		await expect( mark ).toHaveCSS( 'box-shadow', 'none' );
		expect( await maskImageOf( mark ) ).toMatch(
			/^url\("data:image\/svg\+xml/
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a sterile run turns the sunburst coral', async ( { page } ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await armSterile( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );

		const mark = page.locator(
			'.bsb-cockpit__topbar .bsb-deck__status-mark'
		);
		await expect( mark ).toHaveClass( /is-sterile/ );
		await expect( mark ).toHaveCSS(
			'background-color',
			'rgb(255, 122, 92)'
		);
		await expect( mark ).toHaveCSS( 'animation-name', 'bsb-sunburst-turn' );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'reduced motion holds the sunburst still', async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );

		const mark = page.locator(
			'.bsb-cockpit__topbar .bsb-deck__status-mark'
		);
		await expect( mark ).toBeVisible();
		await expect( mark ).toHaveCSS( 'animation-name', 'none' );
		expect( await maskImageOf( mark ) ).toMatch(
			/^url\("data:image\/svg\+xml/
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
