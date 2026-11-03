import {
	test,
	expect,
	type APIRequestContext,
	type Locator,
	type Page,
} from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { SCREENSHOTS_STORAGE_STATE } from '../../wp-playground/config.mts';
import {
	STAND_IN_START_LEVEL,
	STAND_IN_STEPS_MS,
	installBatteryStandIn,
	standInSchedule,
} from './BatteryStandIn.mts';
import { ABOUT_PAGE, DEMO_POST } from './SiteStaging.mts';

/**
 * Captures the WordPress.org listing screenshots into `.wordpress-org/`.
 *
 * Run it with `pnpm screenshots`, never as part of the e2e suite. The tests
 * run in order on one Playground site: staging first (the site's pages, the
 * course order and five seeded sessions), then the admin screens, then the
 * cockpit. Each test writes one `screenshot-N.png`, numbered as WordPress.org
 * shows them and as the `== Screenshots ==` captions in `readme.txt` describe
 * them. The live-run shot comes last and takes longest: see
 * `BatteryStandIn.mts`.
 */

test.describe.configure( { mode: 'serial' } );

const SESSIONS_ENDPOINT = '/wp-json/wp/v2/bsb_session';
const SETTINGS_ENDPOINT = '/wp-json/wp/v2/settings';
const COURSE_ORDER_OPTION = 'bsb_course_order';

/** The bundled catalog's slugs in their default course order. */
const BUNDLED_SLUGS_IN_ORDER = [
	'article-1',
	'gallery',
	'article-2',
	'video',
	'links',
] as const;

/** The post id of WordPress's "Hello world!" post, which becomes the demo post. */
const HELLO_WORLD_POST_ID = 1;

/** The post id of WordPress's "Sample Page", which becomes the About page. */
const SAMPLE_PAGE_ID = 2;

/** The cockpit's step battery stand-in schedule: enough steps to outlast the hero wait. */
const STAND_IN_STEP_COUNT = 40;

/** The most the hero shot waits for the deck's readouts to fill in. */
const READOUTS_WAIT_MS = 16 * 60 * 1000;

/** The most the hero shot waits for the surfer to bring the chart into view. */
const CHART_WAIT_MS = 20 * 60 * 1000;

/** How many past sessions the listing seeds. */
const SEEDED_SESSION_COUNT = 5;

/** The post id of the seeded session the postcard shot opens. */
let postcardSessionId = 0;

/**
 * Mints a REST nonce for the logged-in admin session.
 *
 * @param request - The authenticated request context.
 * @return The nonce string.
 */
async function restNonce( request: APIRequestContext ): Promise< string > {
	const response = await request.get(
		'/wp-admin/admin-ajax.php?action=rest-nonce'
	);

	return ( await response.text() ).trim();
}

/**
 * Writes one screenshot of the viewport into `.wordpress-org/`.
 *
 * @param page   - The page to capture.
 * @param number - The screenshot's number, as WordPress.org orders them.
 * @param path   - Where to write it; defaults to the listing's file for the number.
 */
async function capture(
	page: Page,
	number: number,
	path = `.wordpress-org/screenshot-${ number }.png`
): Promise< void > {
	await page.evaluate( () => document.fonts.ready );
	await page.screenshot( { path, animations: 'disabled', caret: 'hide' } );
}

/**
 * Waits for a locator's running CSS transitions and animations to finish.
 *
 * @param locator - The element whose transitions to wait out.
 */
async function settle( locator: Locator ): Promise< void > {
	await locator.evaluate( ( element ) =>
		Promise.all(
			element.getAnimations().map( ( animation ) => animation.finished )
		)
	);
}

/**
 * Opens the cockpit on a fresh page with the scripted battery installed.
 *
 * @param page - The page to open the cockpit in.
 */
async function openCockpitWithStandIn( page: Page ): Promise< void > {
	await page.addInitScript( installBatteryStandIn, {
		startLevel: STAND_IN_START_LEVEL,
		schedule: standInSchedule(
			STAND_IN_START_LEVEL,
			STAND_IN_STEPS_MS,
			STAND_IN_STEP_COUNT
		),
	} );
	await page.goto( '/?bsbSession=cockpit' );

	// The cockpit opens on its picture postcard with the control deck tucked
	// away; turning the card to its written back slides the deck in.
	await page
		.locator(
			'.bsb-flipcard--idle .bsb-flipcard__face--front .bsb-flipcard__flip'
		)
		.click();
	await expect( page.locator( '.wp-block-bsb-cockpit' ) ).toHaveClass(
		/is-deck-shown/
	);
	await expect( page.locator( '.bsb-run' ) ).toBeVisible();
	await settle( page.locator( '.bsb-cockpit__deck' ) );
	await settle( page.locator( '.bsb-flipcard--idle .bsb-flipcard__inner' ) );
}

test.beforeAll( async ( { browser } ) => {
	const context = await browser.newContext( {
		baseURL: test.info().project.use.baseURL,
		storageState: SCREENSHOTS_STORAGE_STATE,
	} );
	const { request } = context;
	const headers = { 'X-WP-Nonce': await restNonce( request ) };

	const about = await request.post(
		`/wp-json/wp/v2/pages/${ SAMPLE_PAGE_ID }`,
		{
			headers,
			data: { title: ABOUT_PAGE.title, content: ABOUT_PAGE.content },
		}
	);
	expect( about.status(), 'staging the About page' ).toBe( 200 );

	const post = await request.post(
		`/wp-json/wp/v2/posts/${ HELLO_WORLD_POST_ID }`,
		{
			headers,
			data: { title: DEMO_POST.title, content: DEMO_POST.content },
		}
	);
	expect( post.status(), 'staging the demo post' ).toBe( 200 );

	const order = await request.post( SETTINGS_ENDPOINT, {
		headers,
		data: {
			[ COURSE_ORDER_OPTION ]: [
				...BUNDLED_SLUGS_IN_ORDER.map( ( slug ) => ( {
					kind: 'bundled',
					slug,
				} ) ),
				{ kind: 'user', id: HELLO_WORLD_POST_ID },
			],
		},
	} );
	expect( order.status(), 'saving the course order' ).toBe( 200 );

	// Playwright can't resolve the run model's `@/` imports, so tsx builds the
	// five REST bodies in a child process (see `PrintSeededSessions.mts`).
	const { postcardIndex, bodies } = JSON.parse(
		execFileSync(
			'pnpm',
			[ 'exec', 'tsx', 'tests/screenshots/PrintSeededSessions.mts' ],
			{ encoding: 'utf8' }
		)
	) as { postcardIndex: number; bodies: unknown[] };
	expect( bodies ).toHaveLength( SEEDED_SESSION_COUNT );

	for ( const [ index, body ] of bodies.entries() ) {
		const created = await request.post( SESSIONS_ENDPOINT, {
			headers,
			data: body,
		} );
		expect( created.status(), `seeding session #${ index + 1 }` ).toBe(
			201
		);

		if ( index === postcardIndex ) {
			postcardSessionId = ( await created.json() ).id as number;
		}
	}

	await context.close();
} );

test( 'screenshot-5: the settings screen', async ( { page } ) => {
	await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );
	await expect( page.locator( '.bsb-settings' ) ).toBeVisible();

	const selectedRows = page.locator( '.bsb-selected .bsb-pages-row--custom' );
	await expect( selectedRows ).toHaveCount( 6 );
	await expect( selectedRows.last() ).toContainText( DEMO_POST.title );

	await capture( page, 5 );
} );

test( 'screenshot-4: the Sessions screen', async ( { page } ) => {
	await page.goto( '/wp-admin/admin.php?page=bsb-sessions' );
	await expect( page.locator( '.bsb-sessions' ) ).toBeVisible();
	await expect(
		page.locator( '#bsb-sessions-app .dataviews-view-table tbody tr' )
	).toHaveCount( SEEDED_SESSION_COUNT );

	await capture( page, 4 );
} );

test( 'screenshot-2: a finished session postcard', async ( { page } ) => {
	await page.goto(
		`/wp-admin/post.php?post=${ postcardSessionId }&action=edit`
	);
	await expect( page.locator( '.bsb-session-detail' ) ).toBeVisible();

	const chart = page.locator( '.bsb-summary__chart' );
	const card = page.locator( '.bsb-session-detail .bsb-flipcard' );
	await expect( card ).toBeVisible();

	// The detail page turns the card to its written back, where the chart and
	// stat tiles are, by itself after a short delay. Wait for that flip to
	// land and settle.
	await expect( card ).toHaveClass( /is-flipped/ );
	await settle( card.locator( '.bsb-flipcard__inner' ) );

	await expect( chart ).toBeVisible();

	await capture( page, 2 );
} );

test( 'screenshot-3: the cockpit run setup', async ( { page } ) => {
	await openCockpitWithStandIn( page );

	// Every control stays at its default, the stats customizer included.
	await expect( page.locator( '.bsb-surfer__customize' ) ).toHaveAttribute(
		'aria-expanded',
		'false'
	);

	await capture( page, 3 );
	await page.close();
} );

test( 'screenshot-1: the cockpit mid-run', async ( { page } ) => {
	test.setTimeout( 2_700_000 );

	await openCockpitWithStandIn( page );
	await page.locator( '.bsb-run' ).click();
	await expect( page.locator( '.bsb-run' ) ).toHaveClass( /is-running/ );

	// Three 1 % steps in: the deck's rates are numbers, not "calibrating".
	const battery = page
		.locator( '[data-wp-text="state.batteryDisplay"]' )
		.first();
	await expect( battery ).toHaveText( '84', { timeout: READOUTS_WAIT_MS } );

	const readoutValues = page.locator(
		'.bsb-deck__readouts .bsb-stat__value:visible'
	);
	await expect
		.poll(
			async () =>
				( await readoutValues.allTextContents() ).every( ( text ) =>
					/\d/.test( text )
				),
			{ timeout: 60_000 }
		)
		.toBe( true );

	// Expand the deck if it opened in its compact form.
	const expand = page.locator( '.bsb-deck__expand' );
	if ( await expand.isVisible() ) {
		await expand.click();
	}

	const viewport = page.locator( '.bsb-cockpit__viewport' );
	const deadline = Date.now() + CHART_WAIT_MS;

	/**
	 * Whether the viewport frame shows the article's power draw chart, whole.
	 * The chart only exists on the bundled article, so finding it also means
	 * the surfer is on that page.
	 *
	 * @return True when the chart's box lies within the frame's viewport.
	 */
	const chartInView = async (): Promise< boolean > => {
		const frame = await ( await viewport.elementHandle() )?.contentFrame();

		return (
			( await frame
				?.evaluate( () => {
					const figure = document.querySelector(
						'figure[aria-label="Power draw comparison chart"]'
					);
					if ( ! figure ) {
						return false;
					}
					const box = figure.getBoundingClientRect();
					return box.top >= 0 && box.bottom <= window.innerHeight;
				} )
				.catch( () => false ) ) ?? false
		);
	};

	for (;;) {
		if ( await chartInView() ) {
			await capture( page, 1 );

			// The surfer keeps scrolling while the shot is taken: keep it only
			// if the chart was still whole afterwards.
			if ( await chartInView() ) {
				await page.close();
				return;
			}
		}

		if ( Date.now() > deadline ) {
			break;
		}

		await page.waitForTimeout( 250 );
	}

	await capture( page, 1, 'test-results/screenshot-1-fallback.png' );
	throw new Error(
		'The article and its power draw chart never came fully into view within 20 minutes.'
	);
} );
