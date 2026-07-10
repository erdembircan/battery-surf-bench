import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the two URL-parameter routes the plugin serves: the
 * course page (rendered through the active theme) and the cockpit dashboard
 * (a stripped, Interactivity-driven page). The e2e blueprint enables
 * WP_DEBUG_DISPLAY, so a PHP warning or notice prints into the page — these
 * tests fail on any such output, which is what catches regressions like a
 * mis-scoped `use` statement in the block render template.
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

test.describe( 'Course page route', () => {
	test( 'renders article-1 through the active theme, no PHP notices', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSessionPage=article-1' );

		// Rendered through the theme: the block-theme document wrapper is present.
		await expect( page.locator( '.wp-site-blocks' ) ).toBeAttached();

		// The article content is reproduced (the masthead nav is intentionally
		// not part of the content).
		await expect( page.locator( 'h1.bsb-article__headline' ) ).toHaveText(
			'The Hidden Cost of a Browser Tab'
		);
		await expect( page.locator( '.bsb-pullquote' ) ).toBeAttached();

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'Surf engine', () => {
	test( 'boots and surfs when the traits URL param is present', async ( {
		page,
	} ) => {
		// Records every `message` the page receives so the engine's page-done
		// postMessage (sent to `window.parent`, which is the page itself here,
		// outside an iframe) can be observed after the fact.
		await page.addInitScript( () => {
			(
				window as unknown as { __bsbMessages: unknown[] }
			 ).__bsbMessages = [];
			window.addEventListener( 'message', ( event ) => {
				(
					window as unknown as { __bsbMessages: unknown[] }
				 ).__bsbMessages.push( event.data );
			} );
		} );

		// Tempo maxed and endurance/literacy/allure/fidget at zero: the surfer
		// scrolls fast and gets bored fast. Speed 10x compresses every wait so
		// the whole page session finishes well within the test timeout.
		await page.goto(
			'/?bsbSessionPage=article-1&bsbTraits=10,0,0,0,0&bsbSpeed=10'
		);

		await page.waitForFunction( () => window.scrollY > 0 );

		await page.waitForFunction(
			() =>
				(
					window as unknown as { __bsbMessages: { type?: string }[] }
				 ).__bsbMessages?.some( ( m ) => m?.type === 'bsb:pageDone' ),
			{ timeout: 20_000 }
		);

		await expectNoPhpNotices( page );
	} );

	test( 'drives a visible fake cursor while surfing', async ( { page } ) => {
		// Fidget maxed, everything else at zero: FidgetWiggle/MicroScroll
		// dominate early ticks, so the cursor moves promptly and repeatedly.
		await page.goto(
			'/?bsbSessionPage=article-1&bsbTraits=0,0,0,0,10&bsbSpeed=10'
		);

		const cursor = page.locator( '.bsb-surf-cursor' );
		await expect( cursor ).toBeAttached();

		const initialTransform = await cursor.evaluate(
			( el ) => ( el as HTMLElement ).style.transform
		);

		await page.waitForFunction(
			( initial ) => {
				const el = document.querySelector(
					'.bsb-surf-cursor'
				) as HTMLElement | null;
				return !! el && el.style.transform !== initial;
			},
			initialTransform,
			{ timeout: 10_000 }
		);

		// Sample the painted position repeatedly while the cursor keeps
		// drifting, and confirm every sample stays inside the viewport — a
		// jittered curve or overshoot bowing past an edge would otherwise
		// carry it off-screen instead of just wandering within bounds.
		const viewport = page.viewportSize();
		const samples: { x: number; y: number }[] = [];
		for ( let i = 0; i < 10; i++ ) {
			const transform = await cursor.evaluate(
				( el ) => ( el as HTMLElement ).style.transform
			);
			const match = transform.match(
				/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/
			);
			if ( match ) {
				samples.push( {
					x: parseFloat( match[ 1 ] ),
					y: parseFloat( match[ 2 ] ),
				} );
			}
			await page.waitForTimeout( 150 );
		}

		expect( samples.length ).toBeGreaterThan( 0 );
		for ( const sample of samples ) {
			expect( sample.x ).toBeGreaterThanOrEqual( 0 );
			expect( sample.y ).toBeGreaterThanOrEqual( 0 );
			if ( viewport ) {
				expect( sample.x ).toBeLessThanOrEqual( viewport.width );
				expect( sample.y ).toBeLessThanOrEqual( viewport.height );
			}
		}

		// The real OS cursor must show as the disabled `not-allowed` affordance
		// everywhere, not just page-wide on the root — a text-bearing element
		// inside the article would otherwise resolve its own `auto` cursor (an
		// I-beam) regardless of the ancestor. It stays visible (unlike the old
		// `cursor: none`) so wiggling the mouse never looks like it broke —
		// the dummy surf cursor sampled above is the thing visibly acting.
		const deckCursor = await page.evaluate(
			() =>
				getComputedStyle(
					document.querySelector( '.bsb-article__deck' )!
				).cursor
		);
		expect( deckCursor ).toBe( 'not-allowed' );
	} );

	test( 'stays a static page when the traits URL param is absent', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSessionPage=article-1' );

		// No fake cursor and no surfing-affordance class — the engine never booted.
		await expect( page.locator( '.bsb-surf-cursor' ) ).toHaveCount( 0 );
		await expect( page.locator( 'html' ) ).not.toHaveClass( /bsb-surfing/ );

		// The real OS cursor stays its normal self on a static page's content —
		// no `not-allowed` affordance without a run actually driving the page.
		const deckCursor = await page.evaluate(
			() =>
				getComputedStyle(
					document.querySelector( '.bsb-article__deck' )!
				).cursor
		);
		expect( deckCursor ).not.toBe( 'not-allowed' );

		// Poll past the engine's settle beat (1000-3000 ms at speed 1, the
		// default with no bsbSpeed param) plus a first tick — an incorrectly
		// booting engine would move scrollY inside this window instead of
		// leaving it pinned at 0 the whole time.
		for ( let i = 0; i < 4; i++ ) {
			await page.waitForTimeout( 1000 );
			expect( await page.evaluate( () => window.scrollY ) ).toBe( 0 );
		}
	} );
} );

test.describe( 'Cockpit surfer profile', () => {
	test( 'renders the surfer field: chips, customize sliders, derived archetype', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// The Surfer field sits among the config controls, its label carrying the
		// live derived archetype name.
		await expect( page.locator( '.bsb-field--surfer' ) ).toBeAttached();
		await expect(
			page.locator(
				'.bsb-surfer__build[data-wp-text="state.archetypeLabel"]'
			)
		).toBeAttached();

		// Class-preset chips load a vector on click.
		await expect(
			page.locator(
				'.bsb-chips .bsb-chip[data-wp-on--click="actions.selectClass"]'
			)
		).toHaveCount( 6 );

		// The five stat sliders sit behind the Customize disclosure, each wired to
		// set its stat; the points readout and Reset round out the panel.
		await expect(
			page.locator(
				'.bsb-surfer__customize[data-wp-on--click="actions.toggleCustomize"]'
			)
		).toBeAttached();
		await expect(
			page.locator(
				'.bsb-stat__slider[data-wp-on--input="actions.setTrait"]'
			)
		).toHaveCount( 5 );
		await expect(
			page.locator(
				'.bsb-surfer__points[data-wp-text="state.pointsLeftDisplay"]'
			)
		).toBeAttached();
		await expect(
			page.locator(
				'.bsb-surfer__reset[data-wp-on--click="actions.resetTraits"]'
			)
		).toBeAttached();

		await expectNoPhpNotices( page );
	} );

	test( 'editing stats updates the points budget and derived archetype live', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// Reveal the control deck by flipping the startup postcard, then open the
		// stat sliders.
		await page
			.locator(
				'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
			)
			.first()
			.click();
		await expect(
			page.locator( '.wp-block-bsb-cockpit.is-deck-shown' )
		).toBeAttached();
		await page.locator( '.bsb-surfer__customize' ).click();

		const points = page.locator( '.bsb-surfer__points' );
		const build = page.locator( '.bsb-surfer__build' );

		// The Balanced default spends the whole budget and reads as Balanced.
		await expect( points ).toHaveText( '0' );
		await expect( build ).toHaveText( 'Balanced' );

		// Lowering the first stat to zero frees points and breaks the Balanced
		// band — the budget and the derived name both update reactively.
		await page
			.locator( '.bsb-stat__slider' )
			.first()
			.evaluate( ( el: HTMLInputElement ) => {
				el.value = '0';
				el.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			} );
		await expect( points ).toHaveText( '5' );
		await expect( build ).not.toHaveText( 'Balanced' );

		// A class chip reloads its preset; the derived name reads it back.
		await page.locator( '.bsb-chip[data-class="Scholar"]' ).click();
		await expect( build ).toHaveText( 'Scholar' );
		await expect( points ).toHaveText( '0' );

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'Cockpit dashboard route', () => {
	test( 'serves a stripped Interactivity dashboard, no PHP notices', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// The interactive region and viewport iframe are present, wired to
		// listen for the surf engine's page-done handshake. The dev-tools panel
		// is a second, separate `bsb/cockpit` region (joined via the
		// store-merge mechanism), so this locator is scoped to the cockpit
		// block's own wrapper.
		await expect(
			page.locator(
				'.wp-block-bsb-cockpit[data-wp-interactive="bsb/cockpit"]'
			)
		).toHaveAttribute(
			'data-wp-init---page-advance',
			'callbacks.initPageAdvance'
		);

		// The control deck is rendered alongside the stage, with the run
		// control wired to the store.
		await expect( page.locator( '.bsb-cockpit__deck' ) ).toBeAttached();
		await expect(
			page.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
		).toBeAttached();

		// The finish-sound toggle ships in both the deck header and the compact
		// top pill, each wired to the same store action.
		await expect(
			page.locator(
				'.bsb-deck__sound[data-wp-on--click="actions.toggleSound"]'
			)
		).toBeAttached();
		await expect(
			page.locator(
				'.bsb-deck__readout-sound[data-wp-on--click="actions.toggleSound"]'
			)
		).toBeAttached();

		// The compact top pill carries the project wordmark in its left-hand
		// lockup, paired with the live status line.
		await expect(
			page.locator( '.bsb-cockpit__topbar .bsb-cockpit__brandmark' )
		).toHaveText( /battery surf bench/i );

		// Duration mode is the default, so the target-drop field ships hidden in
		// the server markup — it must not flash in before hydration hides it.
		await expect( page.locator( '.bsb-field--target' ) ).toBeHidden();

		// Before a run the stage shows the startup postcard, not the iframe. It is
		// the shared flip card on its picture front, turned by its own store field
		// (idleFlipped) — distinct from the summary card's flip.
		await expect( page.locator( '.bsb-cockpit__idle' ) ).toBeVisible();
		await expect(
			page.locator(
				'.bsb-flipcard--idle[data-wp-class--is-flipped="state.isIdleFlipped"]'
			)
		).toBeAttached();
		await expect(
			page
				.locator(
					'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
				)
				.first()
		).toBeAttached();
		await expect(
			page.locator(
				'.bsb-cockpit__postcard-side--guide .bsb-cockpit__postcard-heading'
			)
		).toHaveText( /how this run works/i );

		// The back's other side carries the unsupported-browser warning, shipped
		// hidden: Chromium has the Battery Status API, so the cockpit stays
		// supported and the guide shows, the warning stays away. The warning is
		// franked with the red postmark variant.
		await expect(
			page.locator( '.bsb-cockpit__postcard-side--warning' )
		).toBeHidden();
		await expect( page.locator( '.bsb-frank--warning' ) ).toBeAttached();

		// At session start the control deck is tucked away (the stylesheet's
		// default) so the postcard stands alone with no hydration flash — the
		// reveal class is absent until a run is live or the startup card is
		// flipped. The deck markup itself is still present (off-screen).
		await expect(
			page.locator( '.wp-block-bsb-cockpit.is-deck-shown' )
		).toHaveCount( 0 );
		await expect( page.locator( '.bsb-cockpit__deck' ) ).toBeAttached();

		// The viewport ships hidden and the benchmarked page is NOT fetched while
		// idle — the iframe src stays empty until surfing starts.
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeHidden();
		await expect(
			page.locator( 'iframe.bsb-cockpit__viewport' )
		).not.toHaveAttribute( 'src', /bsbSessionPage/ );

		// The wrap itself carries no cursor override of its own — only its
		// `.bsb-cockpit__shield` child does — so it resolves to the ordinary
		// `auto` cursor. `getComputedStyle` still resolves on a `hidden`
		// element, so this holds even before a run starts.
		const viewportWrapCursor = await page.evaluate(
			() =>
				getComputedStyle(
					document.querySelector( '.bsb-cockpit__viewport-wrap' )!
				).cursor
		);
		expect( viewportWrapCursor ).toBe( 'auto' );

		// The interaction shield remains in the markup — it governs the viewport
		// once a run starts; its behaviour is unit-covered. The view-only state is
		// surfaced by the notification toast, present but hidden until raised.
		await expect( page.locator( '.bsb-cockpit__shield' ) ).toBeAttached();
		await expect( page.locator( '.bsb-cockpit__toast' ) ).toBeHidden();

		// The run-summary flip card is present but hidden until a run ends, with
		// its flip control and report wired to the store. It reuses the same shared
		// flip-card shell as the startup postcard, bound to the summary's flip field.
		await expect( page.locator( '.bsb-summary' ) ).toBeHidden();
		await expect(
			page.locator(
				'.bsb-flipcard--summary[data-wp-class--is-flipped="state.isFlipped"]'
			)
		).toBeAttached();
		await expect(
			page
				.locator(
					'.bsb-flipcard--summary .bsb-flipcard__flip[data-wp-on--click="actions.toggleFlip"]'
				)
				.first()
		).toBeAttached();

		// Stripped dashboard: every theme or other-plugin stylesheet is dequeued,
		// so no foreign CSS leaks in. Only the cockpit's own stylesheet and the
		// dev-tools panel's stylesheet survive the strip — the e2e blueprint runs
		// with the dev-tools gate open, so its style is spared too.
		const stylesheets = page.locator( 'link[rel="stylesheet"]' );
		await expect( stylesheets ).toHaveCount( 2 );
		const hrefs = await stylesheets.evaluateAll( ( links ) =>
			links.map( ( link ) => link.getAttribute( 'href' ) )
		);
		expect(
			hrefs.some( ( href ) =>
				/style-cockpit-dashboard/.test( href ?? '' )
			)
		).toBe( true );
		expect(
			hrefs.some( ( href ) => /style-devtools/.test( href ?? '' ) )
		).toBe( true );

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'Cockpit behavior barks', () => {
	test( 'wires the behavior-start bark pill inside the viewport, hidden at rest', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// The layer sits inside the viewport wrap (so it reads as "inside" the
		// simulated page) and is aria-hidden — barks are decorative, not
		// announced information.
		const barkLayer = page.locator(
			'.bsb-cockpit__viewport-wrap .bsb-cockpit__bark-layer'
		);
		await expect( barkLayer ).toBeAttached();
		await expect( barkLayer ).toHaveAttribute( 'aria-hidden', 'true' );

		// The pill itself ships hidden and carries the store bindings its
		// lifecycle depends on.
		const bark = barkLayer.locator( '.bsb-cockpit__bark' );
		await expect( bark ).toBeHidden();
		await expect( bark ).toHaveAttribute(
			'data-wp-bind--hidden',
			'!state.hasBark'
		);
		await expect( bark ).toHaveAttribute(
			'data-wp-on--animationend',
			'callbacks.onBarkAnimationEnd'
		);

		await expect(
			page.locator(
				'.wp-block-bsb-cockpit[data-wp-interactive="bsb/cockpit"]'
			)
		).toHaveAttribute( 'data-wp-init---bark', 'callbacks.initBark' );

		await expectNoPhpNotices( page );
	} );

	// Live assertion: starting a run at the fastest demo speed should raise a
	// bark within a generous window — six of the engine's nine behaviors bark,
	// so one should win quickly.
	test( 'raises a bark pill during a live, fast run', async ( { page } ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// The e2e blueprint's host reports charging, which blocks a live run;
		// force discharging through the dev-tools override, as the other cockpit
		// e2e specs that need a live run already do (see DevTools.spec.mts).
		await page.locator( '.bsb-devtools__pill' ).click();
		await page.locator( '[data-devtools-charging="discharging"]' ).click();
		await page.locator( '.bsb-devtools__card-close' ).click();

		// Reveal the deck by flipping the startup postcard, pick the fastest
		// demo speed, then start the run.
		await page
			.locator(
				'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
			)
			.first()
			.click();
		await page
			.locator( '.bsb-seg--speed .bsb-seg__option[data-speed="10"]' )
			.click();
		await page
			.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
			.click();

		await expect( page.locator( '.bsb-cockpit__bark' ) ).toBeVisible( {
			timeout: 30_000,
		} );
	} );
} );

test.describe( 'Viewport load guard', () => {
	/**
	 * Forces discharging through the dev-tools panel (so a run can start
	 * regardless of the host's real battery/charging state, the same seam the
	 * plugged-in-stops-a-run e2e coverage uses) and starts a run.
	 *
	 * @param page - The page to act on.
	 */
	async function startDischargingRun( page: Page ): Promise< void > {
		await page.locator( '.bsb-devtools__pill' ).click();
		await page.locator( '[data-devtools-charging="discharging"]' ).click();
		await page.locator( '.bsb-devtools__card-close' ).click();

		await page
			.locator(
				'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
			)
			.first()
			.click();
		await page
			.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
			.click();
	}

	test( 'stops the run when the viewport loads a page that is not a course page', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );
		await startDischargingRun( page );

		const viewport = page.locator( 'iframe.bsb-cockpit__viewport' );
		await expect( viewport ).toHaveAttribute( 'src', /bsbSessionPage/ );
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeVisible();
		await expect( page.locator( '.bsb-summary' ) ).toBeHidden();

		// Drive the viewport to a slug the catalog does not carry — same-origin,
		// so it exercises the guard's real `load` handling rather than a
		// same-origin/cross-origin distinction the guard does not need to make.
		// A missing/renamed/deleted catalog slug falls through to a 200 homepage
		// fallback (not a 404) that the course router never served, so it never
		// carries the router-stamped `bsb-course-page` body class — exactly the
		// failure this guard exists to catch.
		await viewport.evaluate( ( iframe: HTMLIFrameElement ) => {
			iframe.src = '/?bsbSessionPage=does-not-exist';
		} );

		// The guard's `load` handler stops the run: the summary is raised with
		// the load-error verdict and the viewport is torn down, rather than the
		// simulation continuing to run blind against a dead page.
		await expect( page.locator( '.bsb-summary' ) ).toBeVisible();
		await expect( page.locator( '.bsb-summary__head' ) ).toHaveText(
			"The page didn't load."
		);
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeHidden();

		await expectNoPhpNotices( page );
	} );

	test( 'keeps running when the viewport loads a real course page (no false-positive stop)', async ( {
		page,
	} ) => {
		// Regression coverage for the bug the maintainer hit: the guard must not
		// mistake a genuinely served course page for a failed load, whether at
		// the moment the run starts or a few seconds into the surf session.
		await page.goto( '/?bsbSession=cockpit' );
		await startDischargingRun( page );

		const viewport = page.locator( 'iframe.bsb-cockpit__viewport' );
		await expect( viewport ).toHaveAttribute( 'src', /bsbSessionPage/ );

		// The router stamps every page it serves with the body-class marker the
		// guard looks for; confirming it here locks the router/guard contract at
		// the e2e layer, not just the unit-level fakes.
		await expect(
			viewport.contentFrame().locator( 'body.bsb-course-page' )
		).toBeAttached();

		// Give the real page (and any of its own asynchronous settling) a few
		// seconds — long enough that a false-positive guard would have already
		// fired — and confirm the run is still live, not stopped.
		await page.waitForTimeout( 5000 );

		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeVisible();
		await expect( page.locator( '.bsb-summary' ) ).toBeHidden();

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'Navigate/reload guard', () => {
	/**
	 * Forces discharging through the dev-tools panel (so a run can start
	 * regardless of the host's real battery/charging state, the same seam the
	 * plugged-in-stops-a-run e2e coverage uses) and starts a run.
	 *
	 * @param page - The page to act on.
	 */
	async function startDischargingRun( page: Page ): Promise< void > {
		await page.locator( '.bsb-devtools__pill' ).click();
		await page.locator( '[data-devtools-charging="discharging"]' ).click();
		await page.locator( '.bsb-devtools__card-close' ).click();

		await page
			.locator(
				'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
			)
			.first()
			.click();
		await page
			.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
			.click();
	}

	test( 'wires the exit-guard init callback on the cockpit root', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await expect(
			page.locator(
				'.wp-block-bsb-cockpit[data-wp-interactive="bsb/cockpit"]'
			)
		).toHaveAttribute(
			'data-wp-init---exit-guard',
			'callbacks.initExitGuard'
		);

		await expectNoPhpNotices( page );
	} );

	test( 'blocks a reload/navigation only while a run is live', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// Idle: a synthetic beforeunload is not blocked.
		const idleBlocked = await page.evaluate( () => {
			const event = new Event( 'beforeunload', { cancelable: true } );
			window.dispatchEvent( event );
			return event.defaultPrevented;
		} );
		expect( idleBlocked ).toBe( false );

		await startDischargingRun( page );

		const viewport = page.locator( 'iframe.bsb-cockpit__viewport' );
		await expect( viewport ).toHaveAttribute( 'src', /bsbSessionPage/ );

		// Live run: the same synthetic beforeunload is now blocked.
		const runningBlocked = await page.evaluate( () => {
			const event = new Event( 'beforeunload', { cancelable: true } );
			window.dispatchEvent( event );
			return event.defaultPrevented;
		} );
		expect( runningBlocked ).toBe( true );

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'User-selected page in the surf rotation', () => {
	/** The `/wp/v2/settings` collection: hosts the `bsb_course_order` field — the same endpoint `CourseLibrary`/`UserPageEngine` read the saved order from. */
	const SETTINGS_ENDPOINT = '/wp-json/wp/v2/settings';

	/** The `/wp/v2/pages` collection, used to mint a throwaway published page as a "user" entry. */
	const PAGES_ENDPOINT = '/wp-json/wp/v2/pages';

	/** The option's REST field name, mirrors `Config.php`'s `settings.option`. */
	const OPTION_KEY = 'bsb_course_order';

	/**
	 * Mints a fresh REST nonce for the logged-in admin session — the same
	 * cookie-auth-plus-nonce pattern `SettingsScreen.spec.mts` uses.
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
	 * Creates a throwaway published page to use as a "user" order entry.
	 *
	 * @param page  - The authenticated page to create through.
	 * @param title - The page's title.
	 * @return The created page's id.
	 */
	async function createUserPage(
		page: Page,
		title: string
	): Promise< number > {
		const response = await page.request.post( PAGES_ENDPOINT, {
			headers: { 'X-WP-Nonce': await nonce( page ) },
			data: { title, status: 'publish' },
		} );
		expect( response.status() ).toBe( 201 );
		const record = await response.json();
		return record.id as number;
	}

	/**
	 * Permanently deletes a page created by {@link createUserPage}.
	 *
	 * @param page   - The authenticated page to delete through.
	 * @param pageId - The page id to delete.
	 */
	async function deleteUserPage(
		page: Page,
		pageId: number
	): Promise< void > {
		await page.request.delete( `${ PAGES_ENDPOINT }/${ pageId }`, {
			headers: { 'X-WP-Nonce': await nonce( page ) },
			data: { force: true },
		} );
	}

	/**
	 * Resets the saved surf-course order back to its registered default (the 5
	 * bundled pages, in catalog order) by posting `null` for the field.
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
	 * Reorders the saved surf-course order so the given user page leads the
	 * sequence, ahead of every bundled page. The settings screen's own picker
	 * only ever appends a newly added page to the end of the sequence — that
	 * ordering behavior is already covered end to end by
	 * `SettingsScreen.spec.mts` — so this exists purely to make the user page
	 * the very first one surfed, through the same persistence endpoint
	 * (`/wp/v2/settings`) the settings screen itself saves through, rather than
	 * this test waiting through all 5 bundled pages first.
	 *
	 * @param page   - The authenticated page to write through.
	 * @param pageId - The user page's post id to move to the front.
	 */
	async function putUserPageFirst(
		page: Page,
		pageId: number
	): Promise< void > {
		const response = await page.request.post( SETTINGS_ENDPOINT, {
			headers: { 'X-WP-Nonce': await nonce( page ) },
			data: {
				[ OPTION_KEY ]: [ { kind: 'user', id: pageId } ],
			},
		} );
		expect( response.ok() ).toBeTruthy();
	}

	// Regression coverage for M3's front-end wiring: a real post or page the
	// site owner picked from the settings screen must surf exactly like a
	// bundled page — loaded through the theme (not the course router), the
	// surf engine running on it, and the run advancing off its own
	// `bsb:pageDone` — rather than being inert dead weight in the sequence.
	test( 'a user page added via the settings screen appears in the rotation, loads, and advances', async ( {
		page,
	} ) => {
		const title = 'Surf Rotation User Page';
		const pageId = await createUserPage( page, title );

		try {
			// Add the page to the surf sequence through the real settings
			// screen, exactly as a site owner would: browse, add, save.
			await page.goto( '/wp-admin/admin.php?page=battery-surf-bench' );

			const browseRow = page
				.locator( '.bsb-browse__row', { hasText: title } )
				.first();
			await expect( browseRow ).toBeVisible();
			await browseRow.getByRole( 'button', { name: 'Add' } ).click();
			await expect(
				browseRow.getByText( 'Added', { exact: true } )
			).toBeVisible();

			const saveButton = page.getByRole( 'button', {
				name: 'Save changes',
			} );
			await expect( saveButton ).toBeEnabled();
			await saveButton.click();
			await expect( saveButton ).toBeDisabled();

			await putUserPageFirst( page, pageId );

			await page.goto( '/?bsbSession=cockpit' );

			// The e2e blueprint's host reports charging, which blocks a live
			// run; force discharging through the dev-tools override, as the
			// other live-run specs in this file do.
			await page.locator( '.bsb-devtools__pill' ).click();
			await page
				.locator( '[data-devtools-charging="discharging"]' )
				.click();
			await page.locator( '.bsb-devtools__card-close' ).click();

			await page
				.locator(
					'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
				)
				.first()
				.click();
			await page
				.locator( '.bsb-seg--speed .bsb-seg__option[data-speed="10"]' )
				.click();
			await page
				.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
				.click();

			const viewport = page.locator( 'iframe.bsb-cockpit__viewport' );

			// The user page leads the sequence, so it is the very first page
			// surfed: a real permalink carrying the traits param, never the
			// course router's `bsbSessionPage` query parameter bundled pages
			// carry.
			await expect( viewport ).toHaveAttribute( 'src', /bsbTraits/ );
			await expect( viewport ).not.toHaveAttribute(
				'src',
				/bsbSessionPage/
			);

			// `UserPageEngine` gated the real page in: the surf engine loaded
			// and stamped the shared course-page body-class marker the
			// viewport load guard looks for, so the run treats it as a
			// successful load rather than stopping on it.
			await expect(
				viewport.contentFrame().locator( 'body.bsb-course-page' )
			).toBeAttached();
			await expect(
				page.locator( '.bsb-cockpit__viewport-wrap' )
			).toBeVisible();
			await expect( page.locator( '.bsb-summary' ) ).toBeHidden();

			// The engine posts `bsb:pageDone` once it moves on, and the run
			// advances to the next page in the sequence — the first bundled
			// page, back through the course router's URL shape.
			await expect( viewport ).toHaveAttribute( 'src', /bsbSessionPage/, {
				timeout: 30_000,
			} );

			expect( await page.content() ).not.toMatch( PHP_NOTICE );
		} finally {
			await resetCourseOrder( page );
			await deleteUserPage( page, pageId );
		}
	} );
} );
