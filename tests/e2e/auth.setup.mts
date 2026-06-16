import { test as setup, expect } from '@playwright/test';
import { ADMIN_STORAGE_STATE } from '../../wp-playground/config.mts';

/**
 * Authenticate once as the default Playground admin (admin/password) and
 * persist the session so the authenticated project can reuse it instead of
 * logging in per test. Replaces the login handling that the
 * `@wordpress/e2e-test-utils-playwright` package would otherwise provide.
 */
setup( 'authenticate as admin', async ( { page } ) => {
	await page.goto( '/wp-login.php' );

	await page.locator( '#user_login' ).fill( 'admin' );
	await page.locator( '#user_pass' ).fill( 'password' );
	await page.locator( '#wp-submit' ).click();

	await page.waitForURL( '**/wp-admin/**' );
	await expect( page.locator( '#wpadminbar' ) ).toBeVisible();

	await page.context().storageState( { path: ADMIN_STORAGE_STATE } );
} );
