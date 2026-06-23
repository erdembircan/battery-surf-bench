import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the benchmark sessions admin screen.
 *
 * The screen mounts a `@wordpress/dataviews` grid that unlocks
 * `@wordpress/components`' private APIs against the `wp.privateApis` global
 * WordPress core locks at runtime. The bundle imports the default DataViews
 * build (its `@wordpress/*` dependencies externalized to WordPress's own script
 * handles) rather than the self-contained `/wp` build, so this is the only
 * place that proves the unlock actually succeeds against the WordPress version
 * the plugin runs on — a regression there throws "Cannot unlock…" at runtime
 * and the grid never mounts. The e2e blueprint enables WP_DEBUG_DISPLAY, so a
 * PHP warning or notice prints into the page and fails the test too.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

test.describe( 'Benchmark sessions screen', () => {
	test( 'mounts the DataViews grid with no PHP notices or console errors', async ( {
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

		await page.goto( '/wp-admin/admin.php?page=bsb-sessions' );

		// The coastal shell renders full-bleed around the grid.
		await expect( page.locator( '.bsb-sessions' ) ).toBeVisible();

		// The brand header carries the wordmark title and subtitle.
		await expect(
			page.getByRole( 'heading', { name: 'Sessions' } )
		).toBeVisible();
		await expect( page.locator( '.bsb-sessions__subtitle' ) ).toHaveText(
			'Benchmark log'
		);

		// The header's Open Cockpit link points at the cockpit route.
		const cockpitLink = page.getByRole( 'link', { name: 'Open Cockpit' } );
		await expect( cockpitLink ).toBeVisible();
		await expect( cockpitLink ).toHaveAttribute(
			'href',
			/bsbSession=cockpit/
		);

		// The bundle mounts DataViews into the screen container. Its presence
		// proves the script booted and the private-API unlock succeeded.
		await expect(
			page.locator( '#bsb-sessions-app .dataviews-wrapper' )
		).toBeVisible();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );

		// The private-API unlock failure surfaces only in the console, so an
		// empty error list is what proves the externalized build works here.
		expect( consoleErrors ).toEqual( [] );
	} );
} );
