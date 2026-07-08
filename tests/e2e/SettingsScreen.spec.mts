import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the settings screen's surf-course order picker.
 *
 * Covers the M2 acceptance bar: the top-level menu renders the settings app
 * (replacing the old empty landing page), the bundled pages show as locked
 * rows, adding a browsed page appends it to the sequence, and saving persists
 * the sequence across a reload. The e2e blueprint enables WP_DEBUG_DISPLAY, so
 * a PHP warning or notice printed into the page fails the run.
 *
 * A second describe block below drives more of the persistence contract
 * directly through the core `/wp/v2/settings` REST endpoint
 * ({@link setCourseOrder}/{@link getCourseOrder}) rather than the
 * drag-and-drop UI: arranging a saved shape (a nearly-complete order, an
 * invalid entry) is far more reliable over REST than scripting the picker to
 * reach the same state, and reading the persisted value back over REST proves
 * the option round-trips the full ordered sequence, not just what the DOM
 * shows. Note that `register_setting`'s own sanitize callback already runs on
 * every write — including these tests' own arrange step — so a value posted
 * through this endpoint can never land in storage genuinely unhealed; the
 * precise regression test for `SettingsScreen` re-healing a value on *read*
 * (one that predates a catalog change and was never re-saved since) lives in
 * `SettingsScreenTest::test_screen_config_heals_a_stale_saved_order_missing_a_bundled_page`,
 * which mocks `get_option()` directly to bypass the write path entirely.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/** The default page and post every fresh WordPress install seeds, used here as a known, always-present browse target. */
const DEFAULT_PAGE_TITLE = 'Sample Page';

/** The default post every fresh WordPress install seeds — a second, distinct browse target from {@link DEFAULT_PAGE_TITLE}. */
const DEFAULT_POST_TITLE = 'Hello world!';

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
		// `exact: true` so this matches only the row's own title span, not the
		// row's "Move … up"/"Move … down" screen-reader-only buttons, whose
		// accessible names also contain this title as a substring.
		await expect(
			page.getByText( 'The Hidden Cost of a Browser Tab', {
				exact: true,
			} )
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

	test( 'a successful save raises a bottom success toast, in the same fixed layer the cockpit toast uses', async ( {
		page,
	} ) => {
		// Guarantees the Sample Page browse row still shows an "Add" button —
		// an earlier test in this file (or a re-run of this one) may already
		// have saved it into the sequence, which would otherwise leave the row
		// showing "Added" and this test waiting forever for a control that
		// isn't there.
		await resetCourseOrder( page );

		try {
			await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

			const browseRow = page
				.locator( '.bsb-browse__row', { hasText: DEFAULT_PAGE_TITLE } )
				.first();
			await browseRow.getByRole( 'button', { name: 'Add' } ).click();

			const saveButton = page.getByRole( 'button', {
				name: 'Save changes',
			} );
			await saveButton.click();

			const toast = page.locator( '.bsb-toast-layer .bsb-toast' );
			await expect( toast ).toBeVisible();
			await expect( toast ).toHaveClass( /is-success/ );
			await expect( toast ).toHaveText( 'Saved' );
			await expect( toast ).toHaveAttribute( 'role', 'status' );
		} finally {
			await resetCourseOrder( page );
		}
	} );

	test( 'a save in flight shields both panes and disables their controls, then lifts once it resolves', async ( {
		page,
	} ) => {
		await resetCourseOrder( page );

		try {
			await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

			const sampleRow = page
				.locator( '.bsb-browse__row', { hasText: DEFAULT_PAGE_TITLE } )
				.first();
			await sampleRow.getByRole( 'button', { name: 'Add' } ).click();

			const selectedRow = page
				.locator( '.bsb-selected .bsb-pages-row--custom', {
					hasText: DEFAULT_PAGE_TITLE,
				} )
				.first();
			await expect( selectedRow ).toBeVisible();

			// Holds the settings POST open so the in-flight window is long
			// enough to observe the shield and the disabled controls, rather
			// than racing a request that (on a local blueprint) usually settles
			// within a handful of milliseconds.
			let releaseSave: () => void = () => {};
			const held = new Promise< void >( ( resolve ) => {
				releaseSave = resolve;
			} );
			await page.route( '**/wp-json/wp/v2/settings', async ( route ) => {
				await held;
				await route.continue();
			} );

			const saveButton = page.getByRole( 'button', {
				name: 'Save changes',
			} );
			await saveButton.click();

			// Both panes are shielded.
			await expect(
				page.locator( '.bsb-browse .bsb-pane-overlay' )
			).toBeVisible();
			await expect(
				page.locator( '.bsb-selected .bsb-pane-overlay' )
			).toBeVisible();

			// A not-yet-added row's Add button is disabled — the sequence can't
			// change mid-save.
			const helloRow = page
				.locator( '.bsb-browse__row', { hasText: DEFAULT_POST_TITLE } )
				.first();
			await expect(
				helloRow.getByRole( 'button', { name: 'Add' } )
			).toBeDisabled();

			// The just-added row's remove control is disabled too.
			await expect(
				selectedRow.locator( '.bsb-pages-row__remove' )
			).toBeDisabled();

			releaseSave();

			await expect(
				page.locator( '.bsb-browse .bsb-pane-overlay' )
			).toBeHidden();
			await expect(
				page.locator( '.bsb-selected .bsb-pane-overlay' )
			).toBeHidden();
			await expect(
				helloRow.getByRole( 'button', { name: 'Add' } )
			).toBeEnabled();
		} finally {
			await resetCourseOrder( page );
		}
	} );

	test( 'Reset changes discards an unsaved add and restores the last-saved sequence', async ( {
		page,
	} ) => {
		await resetCourseOrder( page );

		try {
			await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

			const resetButton = page.getByRole( 'button', {
				name: 'Reset changes',
			} );
			await expect( resetButton ).toBeDisabled();

			const browseRow = page
				.locator( '.bsb-browse__row', { hasText: DEFAULT_PAGE_TITLE } )
				.first();
			await browseRow.getByRole( 'button', { name: 'Add' } ).click();
			await expect( resetButton ).toBeEnabled();

			await resetButton.click();

			await expect( resetButton ).toBeDisabled();
			await expect(
				page.getByRole( 'button', { name: 'Save changes' } )
			).toBeDisabled();
			await expect(
				browseRow.getByRole( 'button', { name: 'Add' } )
			).toBeVisible();
			await expect(
				page.locator( '.bsb-selected .bsb-pages-row--custom', {
					hasText: DEFAULT_PAGE_TITLE,
				} )
			).toHaveCount( 0 );
		} finally {
			await resetCourseOrder( page );
		}
	} );

	test( 'unsaved changes trigger the browser leave-confirmation on navigating away', async ( {
		page,
	} ) => {
		await resetCourseOrder( page );

		try {
			await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

			const browseRow = page
				.locator( '.bsb-browse__row', { hasText: DEFAULT_PAGE_TITLE } )
				.first();
			await browseRow.getByRole( 'button', { name: 'Add' } ).click();

			let sawBeforeUnload = false;
			page.once( 'dialog', async ( dialog ) => {
				sawBeforeUnload = dialog.type() === 'beforeunload';
				await dialog.dismiss();
			} );

			await page.evaluate( () => {
				window.location.href = 'about:blank';
			} );
			await page.waitForTimeout( 300 );

			expect( sawBeforeUnload ).toBe( true );
			// The dismissed dialog cancelled the navigation — still on the
			// settings screen, sequence intact.
			await expect( page.locator( '.bsb-picker' ) ).toBeVisible();
		} finally {
			await resetCourseOrder( page );
		}
	} );
} );

/** The `/wp/v2/settings` collection: hosts the `bsb_course_order` field. */
const SETTINGS_ENDPOINT = '/wp-json/wp/v2/settings';

/** The `/wp/v2/pages` collection, used to mint a throwaway published page as a "user" entry. */
const PAGES_ENDPOINT = '/wp-json/wp/v2/pages';

/** The option's REST field name. */
const OPTION_KEY = 'bsb_course_order';

/** The bundled catalog's slugs, in course order — mirrors `CourseCatalog::PAGES`. */
const BUNDLED_SLUGS_IN_ORDER = [
	'article-1',
	'gallery',
	'article-2',
	'video',
	'links',
] as const;

/** A single order entry, the shape the option's REST schema persists. */
type OrderEntry =
	| { kind: 'bundled'; slug: string }
	| { kind: 'user'; id: number };

/**
 * Mints a fresh REST nonce for the logged-in admin session — the same
 * cookie-auth-plus-nonce pattern `SessionPersistence.spec.mts` uses. Cookie
 * auth alone authenticates a write request but WordPress also requires this
 * header on it to guard against CSRF.
 *
 * @param page - The authenticated page to mint the nonce for.
 * @return The nonce string.
 */
async function nonce( page: Page ): Promise< string > {
	return (
		await (
			await page.request.get(
				'/wp-admin/admin-ajax.php?action=rest-nonce'
			)
		).text()
	).trim();
}

/**
 * Reads the currently saved (and heal-on-read sanitized) surf-course order
 * straight from the option's REST field.
 *
 * The settings collection requires `manage_options` even to read, and
 * WordPress silently demotes a cookie-authenticated request with no nonce to
 * anonymous — so this GET needs the same nonce header a write would, or it
 * comes back a 401 as an anonymous request rather than the admin session.
 *
 * @param page - The authenticated page to read through.
 * @return The saved order.
 */
async function getCourseOrder( page: Page ): Promise< OrderEntry[] > {
	const response = await page.request.get( SETTINGS_ENDPOINT, {
		headers: { 'X-WP-Nonce': await nonce( page ) },
	} );
	expect( response.ok() ).toBeTruthy();
	const settings = await response.json();
	return settings[ OPTION_KEY ];
}

/**
 * Overwrites the saved surf-course order directly, bypassing the picker UI —
 * used to arrange states (a stale order, an invalid user id) that would be
 * slow or flaky to reach by driving drag-and-drop.
 *
 * @param page  - The authenticated page to write through.
 * @param order - The raw order to save; sanitized server-side exactly as a
 *              real save would be.
 */
async function setCourseOrder(
	page: Page,
	order: OrderEntry[]
): Promise< void > {
	const response = await page.request.post( SETTINGS_ENDPOINT, {
		headers: { 'X-WP-Nonce': await nonce( page ) },
		data: { [ OPTION_KEY ]: order },
	} );
	expect( response.ok() ).toBeTruthy();
}

/**
 * Resets the saved surf-course order back to its registered default (the 5
 * bundled pages, in catalog order) by posting `null` for the field — the
 * settings endpoint deletes the option on `null`, so the next read falls back
 * to the default `register_setting` registered.
 *
 * @param page - The authenticated page to reset through.
 */
async function resetCourseOrder( page: Page ): Promise< void > {
	const response = await page.request.post( SETTINGS_ENDPOINT, {
		headers: { 'X-WP-Nonce': await nonce( page ) },
		data: { [ OPTION_KEY ]: null },
	} );
	expect( response.ok() ).toBeTruthy();
}

/**
 * Creates a throwaway published page to use as a "user" order entry.
 *
 * @param page  - The authenticated page to create through.
 * @param title - The page's title.
 * @return The created page's id.
 */
async function createPage( page: Page, title: string ): Promise< number > {
	const response = await page.request.post( PAGES_ENDPOINT, {
		headers: { 'X-WP-Nonce': await nonce( page ) },
		data: { title, status: 'publish' },
	} );
	expect( response.status() ).toBe( 201 );
	const record = await response.json();
	return record.id as number;
}

/**
 * Permanently deletes a page created by {@link createPage}.
 *
 * @param page   - The authenticated page to delete through.
 * @param pageId - The page id to delete.
 */
async function deletePage( page: Page, pageId: number ): Promise< void > {
	await page.request.delete( `${ PAGES_ENDPOINT }/${ pageId }`, {
		headers: { 'X-WP-Nonce': await nonce( page ) },
		data: { force: true },
	} );
}

test.describe( 'Settings screen order persistence and heal-on-read (REST)', () => {
	test.beforeEach( async ( { page } ) => {
		// Every test arranges its own starting state — this guards against a
		// leftover save from an earlier test (e.g. the picker-driven save test
		// above) bleeding into these.
		await resetCourseOrder( page );
	} );

	test.afterEach( async ( { page } ) => {
		await resetCourseOrder( page );
	} );

	test( 'shows exactly the 5 bundled rows, in catalog order, when no order has been saved', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

		const rows = page.locator( '.bsb-selected .bsb-pages-row--custom' );
		await expect( rows ).toHaveCount( 5 );
		await expect( rows.locator( '.bsb-pages-row__remove' ) ).toHaveCount(
			0
		);

		const order = await getCourseOrder( page );
		expect( order ).toEqual(
			BUNDLED_SLUGS_IN_ORDER.map( ( slug ) => ( {
				kind: 'bundled',
				slug,
			} ) )
		);
	} );

	test( 'saving persists the full ordered sequence — bundled slugs and a newly added user id — to the option', async ( {
		page,
	} ) => {
		const pageId = await createPage( page, 'REST E2E Persistence Target' );

		try {
			await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

			const browseRow = page
				.locator( '.bsb-browse__row', {
					hasText: 'REST E2E Persistence Target',
				} )
				.first();
			await expect( browseRow ).toBeVisible();
			await browseRow.getByRole( 'button', { name: 'Add' } ).click();

			const saveButton = page.getByRole( 'button', {
				name: 'Save changes',
			} );
			await expect( saveButton ).toBeEnabled();
			await saveButton.click();
			await expect( saveButton ).toBeDisabled();

			const order = await getCourseOrder( page );
			expect( order ).toEqual( [
				...BUNDLED_SLUGS_IN_ORDER.map( ( slug ) => ( {
					kind: 'bundled',
					slug,
				} ) ),
				{ kind: 'user', id: pageId },
			] );
		} finally {
			await deletePage( page, pageId );
		}
	} );

	test( 'renders a saved order missing a bundled page as the full, healed 6-row sequence, with the saved user page showing by its title, not its raw id', async ( {
		page,
	} ) => {
		// NOTE: `register_setting`'s own sanitize callback (wired by
		// `CourseOrderOption`, unchanged by this fix) already runs on every
		// write to the option — including this REST arrange step — so what
		// lands in the database here is already healed, not genuinely stale.
		// That write-time healing was already true before this fix and is
		// covered by `CourseOrderSanitizerTest`. What is new, and what this
		// test actually exercises end to end, is `SettingsScreen` running the
		// saved value through the sanitizer *again* on every read (so a value
		// that really did predate a catalog change — impossible to arrange
		// through the public REST API within a single test run — renders
		// healed too) and seeding the user page's title server-side. The
		// precise regression test for the read-time heal itself, where
		// `get_option()` is mocked to return a genuinely raw, unsanitized
		// value, is `SettingsScreenTest::test_screen_config_heals_a_stale_saved_order_missing_a_bundled_page`.
		const pageId = await createPage( page, 'REST E2E Heal Target' );

		try {
			await setCourseOrder( page, [
				{ kind: 'bundled', slug: 'article-1' },
				{ kind: 'bundled', slug: 'gallery' },
				{ kind: 'bundled', slug: 'article-2' },
				{ kind: 'bundled', slug: 'video' },
				// 'links' omitted on arrange — re-inserted by sanitization
				// either way, but exercises the same healing path a genuinely
				// stale value would take on render.
				{ kind: 'user', id: pageId },
			] );

			await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

			const rows = page.locator( '.bsb-selected .bsb-pages-row--custom' );
			// The 4 saved bundled rows + the re-inserted 'links' page + the user row.
			await expect( rows ).toHaveCount( 6 );
			await expect(
				rows.filter( { hasText: 'News Hub: Energy & Computing' } )
			).toHaveCount( 1 );

			const userRow = rows.filter( {
				hasText: 'REST E2E Heal Target',
			} );
			await expect( userRow ).toHaveCount( 1 );
			// The title itself renders — never the raw post id or a placeholder.
			await expect(
				userRow.locator( '.bsb-pages-row__title' )
			).toHaveText( 'REST E2E Heal Target' );

			expect( await page.content() ).not.toMatch( PHP_NOTICE );
		} finally {
			await deletePage( page, pageId );
		}
	} );

	test( 'never renders a saved user entry whose id no longer resolves, while the bundled rows remain', async ( {
		page,
	} ) => {
		await setCourseOrder( page, [
			...BUNDLED_SLUGS_IN_ORDER.map(
				( slug ): OrderEntry => ( { kind: 'bundled', slug } )
			),
			// Astronomically unlikely to ever exist on the test blueprint.
			{ kind: 'user', id: 999999999 },
		] );

		await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

		const rows = page.locator( '.bsb-selected .bsb-pages-row--custom' );
		await expect( rows ).toHaveCount( 5 );
		// Every remaining row is bundled — no page/post badge survived.
		await expect(
			page.locator(
				'.bsb-selected .bsb-badge--page, .bsb-selected .bsb-badge--post'
			)
		).toHaveCount( 0 );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );

		// The invalid id never reaches storage in the first place — the same
		// sanitize callback runs on this arrange step's write, dropping it
		// before it is ever saved — so the persisted option is already just
		// the 5 bundled slugs too.
		const order = await getCourseOrder( page );
		expect( order ).toEqual(
			BUNDLED_SLUGS_IN_ORDER.map( ( slug ) => ( {
				kind: 'bundled',
				slug,
			} ) )
		);
	} );
} );
