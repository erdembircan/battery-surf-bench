import { test as setup, expect } from '@playwright/test';
import { SCREENSHOTS_STORAGE_STATE } from '../../wp-playground/config.mts';

/**
 * Logs the screenshot run into its Playground site once, through the real
 * login form, and saves the session for the capture spec. It is the e2e
 * suite's `auth.setup.mts` pointed at a storage file of its own, so a capture
 * never touches the e2e suite's saved login.
 */
setup( 'authenticate as admin', async ( { page } ) => {
	setup.setTimeout( 150_000 );

	const ATTEMPTS = 3;
	for ( let attempt = 1; attempt <= ATTEMPTS; attempt++ ) {
		await page.goto( '/wp-login.php' );
		await page.locator( '#user_login' ).fill( 'admin' );
		await page.locator( '#user_pass' ).fill( 'password' );
		await page.locator( '#wp-submit' ).click();

		try {
			// Fast per-attempt timeout: a transient boot/redirect race that
			// leaves us on wp-login should recover on the next attempt rather
			// than burning the whole test timeout on one hung navigation.
			await page.waitForURL( '**/wp-admin/**', { timeout: 30_000 } );
			break;
		} catch ( error ) {
			if ( attempt === ATTEMPTS ) {
				throw error;
			}
		}
	}

	await expect( page.locator( '#wpadminbar' ) ).toBeVisible();
	await page.context().storageState( { path: SCREENSHOTS_STORAGE_STATE } );
} );
