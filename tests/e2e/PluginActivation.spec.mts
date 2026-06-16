import { test, expect } from '@playwright/test';

/**
 * End-to-end smoke test verifying the plugin boots inside a real WordPress
 * instance. The e2e blueprint logs in as admin and activates the plugin before
 * this runs, so navigating to an admin page authenticates via the Playground
 * auto-login cookie.
 */
test.describe( 'Plugin activation', () => {
	test( 'is active on the plugins screen', async ( { page } ) => {
		await page.goto( '/wp-admin/plugins.php' );

		const pluginRow = page.locator( 'tr[data-slug="battery-surf-bench"]' );
		await expect( pluginRow ).toBeVisible();

		// Active plugins carry an "active" class on their row.
		await expect( pluginRow ).toHaveClass( /active/ );

		// A "Deactivate" link confirms the plugin is active.
		await expect(
			pluginRow.locator( 'a', { hasText: 'Deactivate' } )
		).toBeVisible();
	} );
} );
