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

	test( 'stays a static page when the traits URL param is absent', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSessionPage=article-1' );

		// Long enough to clear the engine's settle beat and first tick many
		// times over, were it (incorrectly) running.
		await page.waitForTimeout( 800 );

		expect( await page.evaluate( () => window.scrollY ) ).toBe( 0 );
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

		// The interactive region and viewport iframe are present. The dev-tools
		// panel is a second, separate `bsb/cockpit` region (joined via the
		// store-merge mechanism), so this locator is scoped to the cockpit
		// block's own wrapper.
		await expect(
			page.locator(
				'.wp-block-bsb-cockpit[data-wp-interactive="bsb/cockpit"]'
			)
		).toBeAttached();

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
