import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the settings screen's surf-course order picker.
 *
 * Covers the M2 acceptance bar: the top-level menu renders the settings app
 * (replacing the old empty landing page), the bundled pages show as locked
 * rows, adding a browsed page appends it to the sequence, and saving persists
 * the sequence across a reload. The e2e blueprint enables WP_DEBUG_DISPLAY, so
 * a PHP warning or notice printed into the page fails the run.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/** The default page and post every fresh WordPress install seeds, used here as a known, always-present browse target. */
const DEFAULT_PAGE_TITLE = 'Sample Page';

test.describe( 'Settings screen', () => {
	test( 'renders the settings app on the top-level menu with no PHP notices or console errors', async ( {
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

		await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

		// The coastal shell renders full-bleed, replacing the old empty landing.
		await expect( page.locator( '.bsb-settings' ) ).toBeVisible();
		await expect(
			page.getByRole( 'heading', { name: 'Battery Surf Bench' } )
		).toBeVisible();
		// The subtitle lives in the shared admin-chrome header (AdminHeaderView),
		// not a settings-specific class.
		await expect( page.locator( '.bsb-admin-head__subtitle' ) ).toHaveText(
			'Settings'
		);

		// The header's New Benchmark link points at the cockpit route.
		const cockpitLink = page.getByRole( 'link', { name: 'New Benchmark' } );
		await expect( cockpitLink ).toBeVisible();
		await expect( cockpitLink ).toHaveAttribute(
			'href',
			/bsbSession=cockpit/
		);

		// The app mounted and rendered the picker.
		await expect(
			page.locator( '#bsb-settings-app .bsb-picker' )
		).toBeVisible();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
		expect( consoleErrors ).toEqual( [] );
	} );

	test( 'shows every bundled page locked, with no remove control', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

		const bundledRows = page.locator(
			'.bsb-pages-row--custom:has(.bsb-badge--bundled)'
		);

		await expect( bundledRows ).toHaveCount( 5 );
		await expect(
			bundledRows.first().locator( '.bsb-pages-row__remove' )
		).toHaveCount( 0 );
		await expect(
			page.getByText( 'The Hidden Cost of a Browser Tab' )
		).toBeVisible();
	} );

	test( 'adding a browsed page appends it to the sequence, and saving persists it across a reload', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

		const browseRow = page
			.locator( '.bsb-browse__row', { hasText: DEFAULT_PAGE_TITLE } )
			.first();
		await expect( browseRow ).toBeVisible();

		await browseRow.getByRole( 'button', { name: 'Add' } ).click();
		await expect(
			browseRow.getByText( 'Added', { exact: true } )
		).toBeVisible();

		const selectedRow = page
			.locator( '.bsb-selected .bsb-pages-row--custom', {
				hasText: DEFAULT_PAGE_TITLE,
			} )
			.first();
		await expect( selectedRow ).toBeVisible();
		await expect(
			selectedRow.locator( '.bsb-pages-row__remove' )
		).toBeVisible();

		const saveButton = page.getByRole( 'button', { name: 'Save changes' } );
		await expect( saveButton ).toBeEnabled();
		await saveButton.click();
		await expect( saveButton ).toBeDisabled();

		await page.reload();

		await expect(
			page
				.locator( '.bsb-selected .bsb-pages-row--custom', {
					hasText: DEFAULT_PAGE_TITLE,
				} )
				.first()
		).toBeVisible();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
