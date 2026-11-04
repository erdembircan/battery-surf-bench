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

/** The cockpit block's root, which carries the store's state classes. */
const COCKPIT =
	'.wp-block-battery-surf-bench-cockpit[data-wp-interactive="battery-surf-bench/cockpit"]';

/**
 * The class the cockpit root carries exactly while the egg is armed: a run is
 * live and the deck is compact.
 */
const ARMED_CLASS = 'is-compact';

/**
 * Enters the full Konami sequence in one page-side task: a `keydown` per key,
 * dispatched on the focused element so it bubbles up to the store's
 * `document`-level listener the way a real keystroke does. Inside a single
 * task nothing else on the page runs between two keys, so every gap stays far
 * below the store's 300ms limit.
 *
 * `page.keyboard.press` can't promise that. Each key costs two round trips
 * through the browser, and on a busy machine one gap can pass 300ms. The store
 * then starts the sequence over and the fin never shows, which fails the test
 * even though the egg works.
 *
 * It throws if an iframe (the surf viewport, say) has focus. Real keystrokes
 * would go into that frame and never reach the cockpit, and dispatching here
 * would hide that.
 *
 * @param page - The page to act on.
 */
async function enterKonami( page: Page ): Promise< void > {
	await page.locator( COCKPIT ).evaluate( ( cockpit, keys ) => {
		const target = cockpit.ownerDocument.activeElement ?? cockpit;

		if ( target instanceof HTMLIFrameElement ) {
			throw new Error(
				'An iframe has focus, so real keystrokes would never reach the cockpit.'
			);
		}

		for ( const key of keys ) {
			target.dispatchEvent(
				new KeyboardEvent( 'keydown', {
					key,
					bubbles: true,
					cancelable: true,
				} )
			);
		}
	}, KONAMI_KEYS );
}

/**
 * Forces discharging through the dev-tools override (so a run can start
 * regardless of the host's real battery/charging state, the same seam every
 * other cockpit e2e spec that needs a live run already uses), flips the
 * startup postcard, picks the fastest demo speed, and starts a run — which
 * opens the compact topbar automatically. Returns only once the cockpit shows
 * the egg armed, so no test enters the code before the store would accept it.
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

	await expect( page.locator( COCKPIT ) ).toContainClass( ARMED_CLASS );
}

test.describe( 'Shark-fin Easter egg', () => {
	test( 'entering the Konami code during a live compact run releases the fin, which auto-hides on its own', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbenchSession=cockpit' );

		await startFastRun( page );

		const topbarFin = page.locator( '.bsb-cockpit__topbar .bsb-fin' );
		await expect( topbarFin ).toBeHidden();

		await enterKonami( page );

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
		await page.goto( '/?bsbenchSession=cockpit' );

		await startFastRun( page );

		const topbarFin = page.locator( '.bsb-cockpit__topbar .bsb-fin' );
		await enterKonami( page );
		await expect( topbarFin ).toBeVisible();

		const startBefore = await topbarFin.evaluate( ( el ) =>
			getComputedStyle( el ).getPropertyValue( '--fin-start' )
		);

		await enterKonami( page );

		const startAfter = await topbarFin.evaluate( ( el ) =>
			getComputedStyle( el ).getPropertyValue( '--fin-start' )
		);
		expect( startAfter ).toBe( startBefore );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the sequence does nothing on the expanded deck — the egg only arms while compact', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbenchSession=cockpit' );

		await startFastRun( page );

		// Expand the deck: the topbar (and its fin) is no longer the readout
		// surface the egg arms against. The run stays live, so the expanded
		// deck alone is what keeps the egg disarmed.
		await page.locator( '.bsb-deck__expand' ).click();
		await expect( page.locator( COCKPIT ) ).not.toContainClass(
			ARMED_CLASS
		);
		await expect(
			page.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
		).toContainClass( 'is-running' );

		await enterKonami( page );

		await expect( page.locator( '.bsb-fin' ).first() ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( "the dev-tools panel's shark button releases the fin on demand, disabled outside the launch window", async ( {
		page,
	} ) => {
		await page.goto( '/?bsbenchSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		const sharkButton = page.locator( '.bsb-devtools__card-shark' );
		await expect( sharkButton ).toBeVisible();
		await expect( sharkButton ).toBeDisabled();

		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );

		await page.locator( '.bsb-devtools__pill' ).click();
		await expect( sharkButton ).toBeEnabled();

		await sharkButton.click();

		const topbarFin = page.locator( '.bsb-cockpit__topbar .bsb-fin' );
		await expect( topbarFin ).toBeVisible();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
