import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the two URL-parameter routes the plugin serves: the
 * course page (rendered through the active theme) and the cockpit dashboard
 * (a stripped, Interactivity-driven page). The e2e blueprint enables
 * WP_DEBUG_DISPLAY, so a PHP warning or notice prints into the page — these
 * tests fail on any such output, which is what catches regressions like a
 * mis-scoped `use` statement in the block render template.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/**
 * Asserts the rendered page carries no PHP warning, notice or error output.
 *
 * @param page - The page to inspect.
 */
async function expectNoPhpNotices( page: Page ): Promise< void > {
	expect( await page.content() ).not.toMatch( PHP_NOTICE );
}

test.describe( 'Course page route', () => {
	test( 'renders article-1 through the active theme, no PHP notices', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSessionPage=article-1' );

		// Rendered through the theme: the block-theme document wrapper is present.
		await expect( page.locator( '.wp-site-blocks' ) ).toBeAttached();

		// The article content is reproduced (the masthead nav is intentionally
		// not part of the content).
		await expect( page.locator( 'h1.bsb-article__headline' ) ).toHaveText(
			'The Hidden Cost of a Browser Tab'
		);
		await expect( page.locator( '.bsb-pullquote' ) ).toBeAttached();

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'Cockpit dashboard route', () => {
	test( 'serves a stripped Interactivity dashboard, no PHP notices', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// The interactive region and viewport iframe are present.
		await expect(
			page.locator( '[data-wp-interactive="bsb/cockpit"]' )
		).toBeAttached();

		// The control deck is rendered alongside the stage, with the run
		// control wired to the store.
		await expect( page.locator( '.bsb-cockpit__deck' ) ).toBeAttached();
		await expect(
			page.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
		).toBeAttached();

		// The finish-sound toggle ships in both the deck header and the compact
		// top pill, each wired to the same store action.
		await expect(
			page.locator(
				'.bsb-deck__sound[data-wp-on--click="actions.toggleSound"]'
			)
		).toBeAttached();
		await expect(
			page.locator(
				'.bsb-deck__readout-sound[data-wp-on--click="actions.toggleSound"]'
			)
		).toBeAttached();

		// Duration mode is the default, so the target-drop field ships hidden in
		// the server markup — it must not flash in before hydration hides it.
		await expect( page.locator( '.bsb-field--target' ) ).toBeHidden();

		// Before a run the stage shows the idle postcard, not the iframe.
		await expect( page.locator( '.bsb-cockpit__idle' ) ).toBeVisible();
		await expect(
			page.locator( '.bsb-cockpit__postcard-heading' )
		).toHaveText( /how this run works/i );

		// The viewport ships hidden and the benchmarked page is NOT fetched while
		// idle — the iframe src stays empty until surfing starts.
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeHidden();
		await expect(
			page.locator( 'iframe.bsb-cockpit__viewport' )
		).not.toHaveAttribute( 'src', /bsbSessionPage/ );

		// The interaction shield and "view only" chip remain in the markup — they
		// govern the viewport once a run starts; their behaviour is unit-covered.
		await expect( page.locator( '.bsb-cockpit__shield' ) ).toBeAttached();
		await expect(
			page.locator( '.bsb-cockpit__shield-badge' )
		).toBeAttached();

		// The run-summary flip card is present but hidden until a run ends, with
		// its flip control and report wired to the store.
		await expect( page.locator( '.bsb-summary' ) ).toBeHidden();
		await expect(
			page.locator(
				'.bsb-summary__card[data-wp-class--is-flipped="state.isFlipped"]'
			)
		).toBeAttached();
		await expect(
			page
				.locator(
					'.bsb-summary__flip[data-wp-on--click="actions.toggleFlip"]'
				)
				.first()
		).toBeAttached();

		// Stripped dashboard: the cockpit's own stylesheet is the only one that
		// survives — every theme or other-plugin stylesheet is dequeued, so no
		// foreign CSS leaks in.
		const stylesheets = page.locator( 'link[rel="stylesheet"]' );
		await expect( stylesheets ).toHaveCount( 1 );
		await expect( stylesheets ).toHaveAttribute(
			'href',
			/style-cockpit-dashboard/
		);

		await expectNoPhpNotices( page );
	} );
} );
