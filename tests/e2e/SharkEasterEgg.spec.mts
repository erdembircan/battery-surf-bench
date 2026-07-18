import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the cockpit's Konami-code Easter egg: while a run is
 * live and the readouts sit in the compact topbar, entering the sequence
 * releases a dorsal fin that swims the wave strip and dives under on its own.
 *
 * The e2e blueprint runs with `WP_DEBUG_DISPLAY`, so a PHP notice printed into
 * the page fails these tests too.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/** The classic Konami code, in the casing a real keyboard event carries. */
const KONAMI_KEYS = [
	'ArrowUp',
	'ArrowUp',
	'ArrowDown',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowLeft',
	'ArrowRight',
	'b',
	'a',
];

/**
 * Presses the full Konami sequence in order. `page.keyboard.press` calls in a
 * row are comfortably under the store's 300ms inter-key timeout.
 *
 * @param page - The page to act on.
 */
async function pressKonami( page: Page ): Promise< void > {
	for ( const key of KONAMI_KEYS ) {
		await page.keyboard.press( key );
	}
}

/**
 * Forces discharging through the dev-tools override (so a run can start
 * regardless of the host's real battery/charging state, the same seam every
 * other cockpit e2e spec that needs a live run already uses), flips the
 * startup postcard, picks the fastest demo speed, and starts a run — which
 * opens the compact topbar automatically.
 *
 * @param page - The page to act on.
 */
async function startFastRun( page: Page ): Promise< void > {
	await page.locator( '.bsb-devtools__pill' ).click();
	await page.locator( '[data-devtools-charging="discharging"]' ).click();
	await page.locator( '.bsb-devtools__card-close' ).click();

	await page
		.locator(
			'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
		)
		.first()
		.click();
	await page
		.locator( '.bsb-seg--speed .bsb-seg__option[data-speed="10"]' )
		.click();
	await page
		.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
		.click();
}

test.describe( 'Shark-fin Easter egg', () => {
	test( 'entering the Konami code during a live compact run releases the fin, which auto-hides on its own', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await startFastRun( page );

		const topbarFin = page.locator( '.bsb-cockpit__topbar .bsb-fin' );
		await expect( topbarFin ).toBeHidden();

		await pressKonami( page );

		await expect( topbarFin ).toBeVisible();
		await expect( topbarFin ).toHaveAttribute(
			'data-wp-bind--hidden',
			'!state.hasShark'
		);

		// The swim self-clears once it (and its trail) finish — no dismiss
		// control, purely the store's own timer.
		await expect( topbarFin ).toBeHidden( { timeout: 15_000 } );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a second Konami entry while a shark is already swimming is a no-op — one shark at a time', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await startFastRun( page );

		const topbarFin = page.locator( '.bsb-cockpit__topbar .bsb-fin' );
		await pressKonami( page );
		await expect( topbarFin ).toBeVisible();

		const startBefore = await topbarFin.evaluate( ( el ) =>
			getComputedStyle( el ).getPropertyValue( '--fin-start' )
		);

		await pressKonami( page );

		const startAfter = await topbarFin.evaluate( ( el ) =>
			getComputedStyle( el ).getPropertyValue( '--fin-start' )
		);
		expect( startAfter ).toBe( startBefore );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the sequence does nothing on the expanded deck — the egg only arms while compact', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await startFastRun( page );

		// Expand the deck: the topbar (and its fin) is no longer the readout
		// surface the egg arms against.
		await page.locator( '.bsb-deck__expand' ).click();

		await pressKonami( page );

		await expect( page.locator( '.bsb-fin' ).first() ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
