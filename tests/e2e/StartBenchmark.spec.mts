import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the "Start Benchmark" admin menu entry and admin
 * bar node.
 *
 * The submenu link cannot carry the cockpit's full URL as its `href` in the
 * server-rendered markup — WordPress builds it from the page slug — so the
 * nav script (`src/admin/StartBenchmarkLink.ts`) progressively enhances it to
 * point at the cockpit and open in a new tab, matching the admin bar node's
 * native `target=_blank`. This proves both surfaces resolve to the cockpit
 * dashboard once the real admin chrome and script have loaded. The e2e
 * blueprint enables WP_DEBUG_DISPLAY, so a PHP warning or notice prints into
 * the page and fails the test too.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

test.describe( 'Start Benchmark menu entry', () => {
	test( 'the admin-menu link and admin-bar node both open the cockpit in a new tab', async ( {
		page,
	} ) => {
		// WordPress only expands a top-level menu's submenu (rather than
		// keeping it collapsed for hover) when the current screen is one of
		// its own pages, so land on a sibling submenu page rather than the
		// dashboard to make the sidebar link visible without simulating hover.
		await page.goto( '/wp-admin/admin.php?page=bsb-sessions' );

		// The nav script rewrites the submenu link's href to the cockpit URL as
		// soon as it boots, so by the time this runs the original `page=`
		// href is already gone — select by the link's text instead.
		const menuLink = page
			.locator( '#adminmenu' )
			.getByRole( 'link', { name: 'Start Benchmark' } );
		await expect( menuLink ).toBeVisible();
		await expect( menuLink ).toHaveAttribute( 'target', '_blank' );
		await expect( menuLink ).toHaveAttribute(
			'href',
			/bsbSession=cockpit/
		);

		// The admin bar node supports target=_blank natively, so it needs no
		// script upgrade.
		const barNode = page.locator(
			'#wpadminbar #wp-admin-bar-bsb-start-benchmark a'
		);
		await expect( barNode ).toBeVisible();
		await expect( barNode ).toHaveAttribute( 'target', '_blank' );
		await expect( barNode ).toHaveAttribute( 'href', /bsbSession=cockpit/ );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'clicking the admin-bar node opens the cockpit dashboard in a new tab', async ( {
		page,
		context,
	} ) => {
		await page.goto( '/wp-admin/index.php' );

		const barNode = page.locator(
			'#wpadminbar #wp-admin-bar-bsb-start-benchmark a'
		);
		await expect( barNode ).toBeVisible();

		const [ popup ] = await Promise.all( [
			context.waitForEvent( 'page' ),
			barNode.click(),
		] );
		await popup.waitForLoadState();

		expect( popup.url() ).toMatch( /bsbSession=cockpit/ );
	} );
} );
