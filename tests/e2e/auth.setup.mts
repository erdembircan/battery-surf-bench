import { test as setup, expect } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from '../../wp-playground/config.mts';

/**
 * Authenticate once as the default Playground admin (admin/password) and
 * persist the session so the authenticated project can reuse it instead of
 * logging in per test. Replaces the login handling that the
 * `@wordpress/e2e-test-utils-playwright` package would otherwise provide.
 *
 * Retries the form login a few times with a short per-attempt timeout. The
 * server can still be warming up its first request or two right after boot;
 * a transient stall on the post-submit navigation should retry fast rather
 * than burn the whole test timeout on one hung `waitForURL`.
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
	await page.context().storageState( { path: ADMIN_STORAGE_STATE } );
} );
