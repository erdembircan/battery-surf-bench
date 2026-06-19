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

		// Interactivity hydrates the iframe src from the bound course list.
		await expect(
			page.locator( 'iframe.bsb-cockpit__viewport' )
		).toHaveAttribute( 'src', /bsbSessionPage=article-1/ );

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
