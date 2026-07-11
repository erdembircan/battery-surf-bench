import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage proving the plugin's gated surfaces actually refuse an
 * anonymous visitor.
 *
 * Every other e2e spec runs under the `authenticated` Playwright project,
 * whose server (`e2eBlueprint`) installs WordPress Playground's own `login`
 * step — which, on the pinned `@wp-playground/cli`, silently promotes ANY
 * cookie-less browser page request to admin (it only skips REST/AJAX
 * requests). That makes it impossible to prove anonymous *page* access is
 * refused against that server: a logged-out browser context there is not
 * actually logged out. This spec runs only under the `unauthenticated`
 * project, which targets a second, independent server booted from
 * `e2eUnauthenticatedBlueprint` (see `wp-playground/blueprint.mts`) — the same
 * blueprint minus the `login` step — so a fresh browser context here stays
 * genuinely anonymous. The `.unauth.spec.mts` suffix is what routes this file
 * to that project and excludes it from `authenticated` (see
 * `playwright.config.mts`). The unauth blueprint also enables
 * `WP_DEBUG_DISPLAY`, so a PHP warning or notice printed into any of these
 * responses fails the run too.
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

test.describe( 'Admin screens require authentication', () => {
	/**
	 * Every gated admin URL, paired with the token that identifies it in the
	 * `redirect_to` query param WordPress's own `auth_redirect()` echoes the
	 * original request URI into (via `wp_login_url( $_SERVER['REQUEST_URI'] )`).
	 * Confirmed against a real anonymous request to each URL: e.g. hitting
	 * `/wp-admin/admin.php?page=battery-surf-bench` redirects to
	 * `wp-login.php?redirect_to=http%3A%2F%2F...%2Fwp-admin%2Fadmin.php%3Fpage%3Dbattery-surf-bench&reauth=1`,
	 * whose decoded `redirect_to` contains exactly `page=battery-surf-bench`.
	 */
	const gatedAdminScreens: { name: string; url: string; token: string }[] = [
		{
			name: 'Settings top-level menu page',
			url: '/wp-admin/admin.php?page=battery-surf-bench',
			token: 'page=battery-surf-bench',
		},
		{
			name: 'Start Benchmark submenu',
			url: '/wp-admin/admin.php?page=bsb-start-benchmark',
			token: 'page=bsb-start-benchmark',
		},
		{
			name: 'Sessions screen',
			url: '/wp-admin/admin.php?page=bsb-sessions',
			token: 'page=bsb-sessions',
		},
		{
			name: 'bsb_session new-post edit screen',
			url: '/wp-admin/post-new.php?post_type=bsb_session',
			token: 'post_type=bsb_session',
		},
	];

	for ( const screen of gatedAdminScreens ) {
		test( `${ screen.name } redirects an anonymous visitor to login, targeting that same screen`, async ( {
			page,
		} ) => {
			await page.goto( screen.url );

			// WordPress's own auth_redirect() (run for every wp-admin/*.php request
			// before the plugin's page-specific code ever executes) bounces a
			// cookie-less request to the login screen with a 302, for any admin
			// page regardless of which plugin owns it.
			expect( page.url() ).toContain( 'wp-login.php' );
			await expect( page.locator( '#user_login' ) ).toBeVisible();

			// Non-vacuous: `auth_redirect()` echoes the original request URI into
			// `redirect_to` (`wp_login_url( $_SERVER['REQUEST_URI'] )`), so this
			// fails if the screen were NOT gated (no redirect at all, hence no
			// `redirect_to`) or if WordPress redirected somewhere other than the
			// screen actually requested.
			const redirectTo = new URL( page.url() ).searchParams.get(
				'redirect_to'
			);
			expect(
				redirectTo,
				'login redirect must target the gated screen'
			).toBeTruthy();
			const decoded = decodeURIComponent( redirectTo ?? '' );
			expect( decoded ).toContain( screen.token );

			await expectNoPhpNotices( page );
		} );
	}
} );

test.describe( 'Front-end gated routes refuse anonymous access', () => {
	test( 'the cockpit dashboard denies an anonymous visitor with a 403, not the dashboard', async ( {
		page,
	} ) => {
		// Cockpit.php's own gate (`Cockpit::deny()`) — distinct from the admin
		// screens above — wp_die()s in place with a 403 and a login link, rather
		// than issuing a 302 redirect: the URL does not change to wp-login.php.
		const response = await page.goto( '/?bsbSession=cockpit' );

		expect( response?.status() ).toBe( 403 );
		expect( page.url() ).not.toContain( 'wp-login.php' );

		// The stripped Interactivity dashboard never rendered.
		await expect(
			page.locator(
				'.wp-block-bsb-cockpit[data-wp-interactive="bsb/cockpit"]'
			)
		).toHaveCount( 0 );

		// The denial screen still offers a way back in.
		await expect(
			page.getByRole( 'link', { name: /log in/i } )
		).toBeVisible();

		// The Interactivity config the cockpit seeds is only written AFTER its
		// capability check passes, so the 403 response body must carry neither
		// nonce it would otherwise embed.
		const body = await page.content();
		expect( body ).not.toContain( 'surfNonce' );
		expect( body ).not.toContain( 'restNonce' );

		await expectNoPhpNotices( page );
	} );

	test( 'the course index route is not served with a bogus nonce and no session', async ( {
		page,
	} ) => {
		// An anonymous visitor can never mint a real `bsb_surf` nonce (it is
		// seeded only on the gated cockpit route), so this is the closest an
		// anonymous request can get to a real one. `CourseRouter::request_authorized()`
		// fails the capability check before the nonce is even read, so the
		// request falls through untouched to whatever the site would otherwise
		// resolve (here, the ordinary front page) rather than being served as a
		// course page.
		await page.goto( '/?bsbSurfIndex=0&bsbNonce=not-a-real-nonce' );

		await expect( page.locator( 'body' ) ).not.toHaveClass(
			/bsb-course-page/
		);
		const scriptSrcs = await page
			.locator( 'script[src]' )
			.evaluateAll( ( scripts ) =>
				scripts.map( ( script ) => script.getAttribute( 'src' ) )
			);
		expect(
			scriptSrcs.some( ( src ) => /surfer\.js/.test( src ?? '' ) )
		).toBe( false );
		expect( await page.content() ).not.toContain( 'surfer.js' );

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'REST endpoints reject anonymous requests', () => {
	/** A finished-run session body, matching the shape SessionPersistence.spec.mts posts. */
	const sessionBody = {
		status: 'publish',
		meta: {
			bsb_status: 'finished',
			bsb_mode: 'target',
		},
	};

	// Collection-list gate closed by SessionRestController: the list no
	// longer leaks published sessions to anonymous visitors.
	test( 'GET wp/v2/bsb_session is refused', async ( { request } ) => {
		const response = await request.get( '/wp-json/wp/v2/bsb_session' );
		expect( response.status() ).toBe( 401 );
	} );

	test( 'GET wp/v2/bsb_session/:id is refused', async ( { request } ) => {
		// SessionRestController::get_item_permissions_check() enforces the
		// capability BEFORE core resolves the post, so an anonymous read is
		// refused with 401 regardless of whether the id exists — core would
		// otherwise return a published session's body under the default view
		// context. A bogus id keeps the test deterministic on an empty database.
		const response = await request.get(
			'/wp-json/wp/v2/bsb_session/999999'
		);
		expect( response.status() ).toBe( 401 );
	} );

	test( 'POST wp/v2/bsb_session is refused', async ( { request } ) => {
		const response = await request.post( '/wp-json/wp/v2/bsb_session', {
			data: sessionBody,
		} );
		expect( response.status() ).toBe( 401 );
	} );

	test( 'GET wp/v2/settings is refused', async ( { request } ) => {
		const response = await request.get( '/wp-json/wp/v2/settings' );
		expect( response.status() ).toBe( 401 );
	} );

	test( 'PATCH wp/v2/settings is refused', async ( { request } ) => {
		const response = await request.patch( '/wp-json/wp/v2/settings', {
			data: { bsb_course_order: null },
		} );
		expect( response.status() ).toBe( 401 );
	} );

	// Same core Settings-controller manage_options gate as PATCH.
	test( 'POST wp/v2/settings is refused', async ( { request } ) => {
		const response = await request.post( '/wp-json/wp/v2/settings', {
			data: { bsb_course_order: null },
		} );
		expect( response.status() ).toBe( 401 );
	} );
} );
