import { test, expect, type Page } from '@playwright/test';
import { FORCE_RTL_COOKIE } from '../../wp-playground/config.mts';

/**
 * End-to-end coverage for the two URL-parameter routes the plugin serves: the
 * index-based course-page route (rendered through the active theme, gated on
 * a `bsb_surf` nonce + capability — see `CourseRouter`) and the cockpit
 * dashboard (a stripped, Interactivity-driven page). The e2e blueprint enables
 * WP_DEBUG_DISPLAY, so a PHP warning or notice prints into the page — these
 * tests fail on any such output, which is what catches regressions like a
 * mis-scoped `use` statement in the block render template.
 *
 * The client never holds a page list — no ids, URLs, titles, order, or
 * count — so these tests exercise the same seam the real client does: mint
 * the `bsb_surf` nonce by visiting the cockpit (see {@link surfNonce}), then
 * build the `?bsbSurfIndex=<n>&bsbNonce=<nonce>` request the same way
 * `RunStore.currentSrc` / `SurfIndexUrl.buildSurfIndexUrl` do.
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

/**
 * Extracts the `bsb_surf` nonce the cockpit's PHP route seeds via
 * `wp_interactivity_config()` — read here straight out of the page's
 * server-rendered Interactivity script-module data (`getConfig()`'s source),
 * exactly like the real client does, rather than minting one out of band.
 * Assumes the page has already navigated to the cockpit
 * (`/?bsbSession=cockpit`).
 *
 * @param page - The page, already on the cockpit dashboard.
 * @return The seeded `bsb_surf` nonce.
 */
async function surfNonce( page: Page ): Promise< string > {
	const nonce = await page.evaluate( () => {
		const el = document.getElementById(
			'wp-script-module-data-@wordpress/interactivity'
		);
		if ( ! el?.textContent ) {
			return null;
		}
		const data = JSON.parse( el.textContent ) as {
			config?: Record< string, { surfNonce?: string } >;
		};
		return data.config?.[ 'bsb/cockpit' ]?.surfNonce ?? null;
	} );

	if ( ! nonce ) {
		throw new Error( 'bsb_surf nonce was not seeded on the cockpit page' );
	}

	return nonce;
}

/**
 * Builds the authorized index-route URL a real run would request, mirroring
 * `RunStore.currentSrc` / `SurfIndexUrl.buildSurfIndexUrl`: an opaque page
 * index plus the `bsb_surf` nonce, with any extra params (e.g. the surfer's
 * `bsbTraits`/`bsbSpeed`) layered on top exactly like `withSurferParams` does.
 *
 * @param nonce - The `bsb_surf` nonce (see {@link surfNonce}).
 * @param index - The opaque page index to request.
 * @param extra - Extra query params to append.
 * @return The relative index-route URL.
 */
function indexUrl(
	nonce: string,
	index: number,
	extra: Record< string, string > = {}
): string {
	const params = new URLSearchParams( {
		bsbSurfIndex: String( index ),
		bsbNonce: nonce,
		...extra,
	} );

	return `/?${ params.toString() }`;
}

/**
 * Records every `message` the page receives, in arrival order, on
 * `window.__bsbMessages`. The surf engine posts its announcements to
 * `window.parent`, which is the page itself outside an iframe, so this is how
 * a test sees them. Call it before the page navigates.
 *
 * @param page - The page to record on.
 */
async function recordMessages( page: Page ): Promise< void > {
	await page.addInitScript( () => {
		const recorder = window as unknown as { __bsbMessages: unknown[] };
		recorder.__bsbMessages = [];
		window.addEventListener( 'message', ( event ) => {
			recorder.__bsbMessages.push( event.data );
		} );
	} );
}

/**
 * Returns the messages {@link recordMessages} has captured so far.
 *
 * @param page - The page being recorded.
 * @return The captured message payloads, in arrival order.
 */
async function recordedMessages(
	page: Page
): Promise< { type?: string; key?: string }[] > {
	return page.evaluate(
		() =>
			(
				window as unknown as {
					__bsbMessages?: { type?: string; key?: string }[];
				}
			 ).__bsbMessages ?? []
	);
}

/**
 * Waits until {@link recordMessages} has captured a message of the given
 * type, carrying the given key when one is named.
 *
 * @param page    - The page being recorded.
 * @param type    - The message `type` to wait for.
 * @param key     - The `key` the message must carry, or null for any key.
 * @param timeout - How long to wait, in ms.
 */
async function waitForMessage(
	page: Page,
	type: string,
	key: string | null = null,
	timeout = 30_000
): Promise< void > {
	await page.waitForFunction(
		( [ wantedType, wantedKey ] ) =>
			(
				window as unknown as {
					__bsbMessages?: { type?: string; key?: string }[];
				}
			 ).__bsbMessages?.some(
				( message ) =>
					message?.type === wantedType &&
					( wantedKey === null || message.key === wantedKey )
			) ?? false,
		[ type, key ] as const,
		{ timeout }
	);
}

/**
 * Whether a console message's source URL belongs to YouTube's embedded
 * player: a `youtube.com`, `youtube-nocookie.com` or `ytimg.com` host, or a
 * subdomain of one. The player runs in a cross-origin frame the plugin does
 * not control and logs its own errors there, such as a Permissions Policy
 * violation when it asks for the `compute-pressure` feature its embed does
 * not grant. A test that wants zero console errors from the plugin skips
 * these.
 *
 * @param url - The URL `ConsoleMessage.location()` reports.
 * @return Whether the message came from YouTube's player.
 */
function isYouTubeUrl( url: string ): boolean {
	let host: string;

	try {
		host = new URL( url ).hostname;
	} catch {
		return false;
	}

	return [ 'youtube.com', 'youtube-nocookie.com', 'ytimg.com' ].some(
		( domain ) => host === domain || host.endsWith( `.${ domain }` )
	);
}

test.describe( 'Course page route', () => {
	test( 'renders article-1 through the active theme, no PHP notices', async ( {
		page,
	} ) => {
		// Mint the `bsb_surf` nonce the same way a real run does — by opening
		// the cockpit — then request index 0 (article-1 leads the default
		// bundled order) through the authorized index route.
		await page.goto( '/?bsbSession=cockpit' );
		const nonce = await surfNonce( page );

		await page.goto( indexUrl( nonce, 0 ) );

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

test.describe( 'Video course page (native YouTube embed)', () => {
	// The bundled video page ("video") leads at index 3 in the default
	// order: article-1, gallery, article-2, video, links.
	const VIDEO_INDEX = 3;

	test( 'renders the native core/embed YouTube block, amended and controllable, no PHP notices', async ( {
		page,
	} ) => {
		// Mint the `bsb_surf` nonce the same way a real run does, then request
		// the video page's index through the authorized index route.
		//
		// WordPress's OWN real oEmbed handling resolves the embed here — this
		// plugin never short-circuits it. wp-playground has no reliable
		// outbound network, so a dev/e2e-only mu-plugin
		// (`youtubeOembedStubMuPlugin`, wired into `e2eBlueprint`) stubs just
		// the one HTTP fetch `pre_oembed_result` would otherwise make,
		// returning a canned `youtube.com/embed/...` iframe shaped like
		// YouTube's real oEmbed response. From there the REAL, unmodified
		// production `YouTubeEmbed::embed_oembed_html()` — running through
		// the real `WP_HTML_Tag_Processor` — amends that iframe's `src`, which
		// is the actual behavior under test: no PHP unit test exercises this
		// amend (see `tests/Course/YouTubeEmbedTest.php`'s doc comment), so
		// this e2e spec is its only coverage.
		await page.goto( '/?bsbSession=cockpit' );
		const nonce = await surfNonce( page );

		await page.goto( indexUrl( nonce, VIDEO_INDEX ) );

		// The native block's own markup: a `figure.wp-block-embed` wrapping
		// the iframe, produced by WordPress's own embed handling
		// (`WP_Embed::autoembed()` + `do_blocks()`), not hand-authored markup.
		const embed = page.locator( 'figure.wp-block-embed' );
		await expect( embed ).toBeAttached();
		const iframe = embed.locator( 'iframe' );
		await expect( iframe ).toBeAttached();

		// The control params the amend merges onto whatever oEmbed produced:
		// JS-API enabled and muted (required for the surf engine's
		// postMessage commands — see `VideoControl.ts`), the served page's
		// own origin, and no `autoplay=1` — the simulation starts playback
		// itself, the embed no longer autoplays on load.
		//
		// This markup contract is as far as e2e coverage goes for playback.
		// The dev/e2e oEmbed stub only stands in for WordPress's server-side
		// oEmbed fetch (wp-playground's PHP has no reliable outbound network)
		// with a canned iframe pointed at a real youtube.com URL. The browser
		// does then load YouTube's real player into that iframe, but whether
		// it plays and emits player-state events depends on YouTube and the
		// network, so nothing here waits on them. Faking that emission here
		// would mean asserting against a fake of the very protocol under
		// test — deliberately not done. The event-driven
		// watch/auto-replay/full-stop logic (`WatchVideo.run`,
		// `Motor.playVideo`/`stopVideo`, and the message-listening
		// `VideoControl` built for a YouTube iframe — its `onEnded`
		// subscription is what drives the auto-replay) is covered entirely by
		// unit tests (`VideoControl.test.ts`, `Motor.test.ts`,
		// `WatchVideo.test.ts`), verified in turn against a real, live
		// YouTube embed while implementing it.
		const src = await iframe.getAttribute( 'src' );
		expect( src ).toMatch( /enablejsapi=1/ );
		expect( src ).toMatch( /mute=1/ );
		expect( new URL( src ?? '' ).searchParams.get( 'origin' ) ).toBe(
			new URL( page.url() ).origin
		);
		expect( src ).not.toMatch( /autoplay=1/ );

		await expectNoPhpNotices( page );
	} );
} );

test.describe( 'Surf engine', () => {
	test( 'boots the surf loop from the traits URL param and moves on', async ( {
		page,
	} ) => {
		await recordMessages( page );

		// Endurance at zero and speed 10x let boredom outgrow every other bid
		// within seconds, so the loop always ends by moving on. What it does
		// before that is a weighted lottery: every behavior keeps a floor bid
		// even at a zero trait, so a scroll is likely but never guaranteed. The
		// next test proves the window scroll deterministically.
		await page.goto( '/?bsbSession=cockpit' );
		const nonce = await surfNonce( page );

		await page.goto(
			indexUrl( nonce, 0, { bsbTraits: '10,0,0,0,0', bsbSpeed: '10' } )
		);

		await waitForMessage( page, 'bsb:pageDone' );

		// The loop ended its natural way: `moveOn` announced itself, then the
		// page reported done.
		const sequence = ( await recordedMessages( page ) ).map( ( message ) =>
			message?.type === 'bsb:behaviorStart'
				? `start:${ message.key }`
				: message?.type
		);
		const moveOn = sequence.indexOf( 'start:moveOn' );

		expect( moveOn ).toBeGreaterThanOrEqual( 0 );
		expect( moveOn ).toBeLessThan( sequence.indexOf( 'bsb:pageDone' ) );

		await expectNoPhpNotices( page );
	} );

	test( 'scrolls the window when a steered scroll burst runs', async ( {
		page,
	} ) => {
		await recordMessages( page );

		// `bsbSterile=1` boots the sterile engine instead of the loop: no
		// auction, and each behavior runs once on a `bsb:steerBehavior`
		// command, over the same motor the loop drives. The dev-tools panel
		// sends that command from the cockpit; outside an iframe the page is
		// its own parent, so the test posts it to the page directly.
		await page.goto( '/?bsbSession=cockpit' );
		const nonce = await surfNonce( page );

		await page.goto(
			indexUrl( nonce, 0, {
				bsbTraits: '10,0,0,0,0',
				bsbSpeed: '10',
				bsbSterile: '1',
			} )
		);

		// The sterile engine reports the page's affordances once it is ready
		// to be steered.
		await waitForMessage( page, 'bsb:pageAffordances' );
		const before = await page.evaluate( () => window.scrollY );

		await page.evaluate( () =>
			window.postMessage(
				{ type: 'bsb:steerBehavior', key: 'scrollBurst' },
				window.location.origin
			)
		);

		await page.waitForFunction(
			( start ) => window.scrollY > start,
			before,
			{ timeout: 30_000 }
		);
		await waitForMessage( page, 'bsb:behaviorEnd', 'scrollBurst' );

		await expectNoPhpNotices( page );
	} );

	test( 'drives a visible fake cursor while surfing', async ( { page } ) => {
		await recordMessages( page );

		// The sterile engine runs one steered `fidgetWiggle` over the same
		// motor and fake cursor the loop drives, so the cursor is certain to
		// move; left to the loop's weighted lottery it only usually would.
		// Speed 1 lets the wiggle run its full 500 ms or more, long enough to
		// sample it mid-drift.
		await page.goto( '/?bsbSession=cockpit' );
		const nonce = await surfNonce( page );

		await page.goto(
			indexUrl( nonce, 0, {
				bsbTraits: '0,0,0,0,10',
				bsbSpeed: '1',
				bsbSterile: '1',
			} )
		);

		await waitForMessage( page, 'bsb:pageAffordances' );

		const cursor = page.locator( '.bsb-surf-cursor' );
		await expect( cursor ).toBeAttached();

		const initialTransform = await cursor.evaluate(
			( el ) => ( el as HTMLElement ).style.transform
		);

		await page.evaluate( () =>
			window.postMessage(
				{ type: 'bsb:steerBehavior', key: 'fidgetWiggle' },
				window.location.origin
			)
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

		// Sample the painted position while the cursor drifts, and confirm
		// every sample stays inside the viewport: a jittered curve or
		// overshoot bowing past an edge would otherwise carry it off-screen
		// instead of just wandering within bounds. The wiggle runs 500 to
		// 1500 ms, so most samples land mid-drift; any taken after it ends
		// check where the cursor came to rest.
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
			await page.waitForTimeout( 50 );
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

		await waitForMessage( page, 'bsb:behaviorEnd', 'fidgetWiggle' );

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
		await page.goto( '/?bsbSession=cockpit' );
		const nonce = await surfNonce( page );

		await page.goto( indexUrl( nonce, 0 ) );

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
		).not.toHaveAttribute( 'src', /bsbSurfIndex/ );

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
		// lifecycle depends on. There is no `animationend` binding — the store's
		// own duration/leave timers drive every transition — and the "ebbing
		// tide" fill carries the store-computed duration, not any numeric or
		// text countdown.
		const bark = barkLayer.locator( '.bsb-cockpit__bark' );
		await expect( bark ).toBeHidden();
		await expect( bark ).toHaveAttribute(
			'data-wp-bind--hidden',
			'!state.hasBark'
		);

		const tide = bark.locator( '.bsb-cockpit__bark-tide' );
		await expect( tide ).toBeAttached();
		await expect( tide ).toHaveAttribute(
			'data-wp-style----bark-dur',
			'state.barkDurationCss'
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

		const bark = page.locator( '.bsb-cockpit__bark' );
		await expect( bark ).toBeVisible( { timeout: 30_000 } );

		// No numeric/text remaining-time indicator — the countdown is pure
		// styling (the "ebbing tide" fill), not a rendered figure.
		await expect( bark ).not.toHaveText( /\d/ );
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
		await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex/ );
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
			iframe.src = '/?bsbSurfIndex=0&bsbNonce=not-a-real-nonce';
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
		await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex/ );

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
		await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex/ );

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
	/** The `/wp/v2/settings` collection: hosts the `bsb_course_order` field — the same endpoint `CourseRouter` reads the saved order from. */
	const SETTINGS_ENDPOINT = '/wp-json/wp/v2/settings';

	/** The `/wp/v2/pages` collection, used to mint a throwaway published page as a "user" entry. */
	const PAGES_ENDPOINT = '/wp-json/wp/v2/pages';

	/** The option's REST field name, mirrors `Config.php`'s `settings.option`. */
	const OPTION_KEY = 'bsb_course_order';

	/** A throwaway published page created for a test, plus its real permalink. */
	interface UserPage {
		id: number;
		link: string;
	}

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
	 * @param page    - The authenticated page to create through.
	 * @param title   - The page's title.
	 * @param content - Serialized block markup for the page's body, as a
	 *                site owner's own editor would have saved it. Omitted for the usual
	 *                empty-body throwaway page.
	 * @return The created page's id and its real permalink.
	 */
	async function createUserPage(
		page: Page,
		title: string,
		content?: string
	): Promise< UserPage > {
		const response = await page.request.post( PAGES_ENDPOINT, {
			headers: { 'X-WP-Nonce': await nonce( page ) },
			data: {
				title,
				status: 'publish',
				...( undefined === content ? {} : { content } ),
			},
		} );
		expect( response.status() ).toBe( 201 );
		const record = await response.json();
		return { id: record.id as number, link: record.link as string };
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

	/** The bundled catalog's slugs, in course order — mirrors `CourseCatalog::PAGES`. */
	const BUNDLED_SLUGS_IN_ORDER = [
		'article-1',
		'gallery',
		'article-2',
		'video',
		'links',
	] as const;

	/**
	 * Reorders the saved surf-course order so the given user page leads the
	 * sequence, ahead of every bundled page. The settings screen's own picker
	 * only ever appends a newly added page to the end of the sequence — that
	 * ordering behavior is already covered end to end by
	 * `SettingsScreen.spec.mts` — so this exists purely to make the user page
	 * the very first one surfed, through the same persistence endpoint
	 * (`/wp/v2/settings`) the settings screen itself saves through, rather than
	 * this test waiting through all 5 bundled pages first. Bundled pages are
	 * no longer force-reinserted by the sanitizer, so every bundled slug the
	 * sequence should still contain is spelled out explicitly here.
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
				[ OPTION_KEY ]: [
					{ kind: 'user', id: pageId },
					...BUNDLED_SLUGS_IN_ORDER.map( ( slug ) => ( {
						kind: 'bundled',
						slug,
					} ) ),
				],
			},
		} );
		expect( response.ok() ).toBeTruthy();
	}

	/**
	 * Builds a native `core/embed` YouTube block's serialized markup for a
	 * video id — the same shape the block editor itself would save for a
	 * pasted YouTube URL (a bare URL inside `.wp-block-embed__wrapper`,
	 * which WordPress's own `autoembed()` converts to an iframe).
	 *
	 * @param id - An 11-character YouTube video id.
	 * @return The block's serialized markup.
	 */
	function youtubeEmbedBlock( id: string ): string {
		const url = `https://www.youtube.com/watch?v=${ id }`;

		return `<!-- wp:embed {"url":"${ url }","type":"video","providerNameSlug":"youtube","responsive":true,"className":"wp-embed-aspect-16-9 wp-has-aspect-ratio"} -->
<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper">
${ url }
</div></figure>
<!-- /wp:embed -->`;
	}

	// Regression coverage for the bug the maintainer flagged: DomMotor.playVideo
	// used to attend only the FIRST video/embed on a page, so a real,
	// multi-video user page would have every video after the first silently
	// go unwatched forever. That selection logic is unit-tested
	// deterministically (Motor.test.ts, seeded rng); what genuinely has no
	// coverage anywhere else is whether the PHP amend (embed_oembed_html)
	// correctly walks and fixes EVERY YouTube iframe on one real, user-authored
	// page, not just the first -- every other e2e video assertion in this file
	// (and the bundled video page) only ever exercises a single embed.
	test( 'a user page with multiple YouTube embeds renders and amends every one of them', async ( {
		page,
	} ) => {
		const videoIds = [ 'jNQXAC9IVRw', 'dQw4w9WgXcQ', '9bZkp7q19f0' ];
		const title = 'Multi-Video User Page';
		const userPage = await createUserPage(
			page,
			title,
			videoIds.map( youtubeEmbedBlock ).join( '\n\n' )
		);

		try {
			// Select it in the saved surf-course order directly through the
			// persistence endpoint -- equivalent to a site owner adding it via
			// the settings screen and saving (that UI flow is already covered
			// end to end by the test above) -- so this test reaches the served
			// page without re-driving it.
			const response = await page.request.post( SETTINGS_ENDPOINT, {
				headers: { 'X-WP-Nonce': await nonce( page ) },
				data: { [ OPTION_KEY ]: [ { kind: 'user', id: userPage.id } ] },
			} );
			expect( response.ok() ).toBeTruthy();

			// Any error the plugin causes fails the test. YouTube's player
			// logs its own errors from its cross-origin frame, which the
			// plugin neither causes nor controls, so those are skipped.
			const consoleErrors: string[] = [];
			page.on( 'console', ( message ) => {
				if (
					'error' === message.type() &&
					! isYouTubeUrl( message.location().url )
				) {
					consoleErrors.push( message.text() );
				}
			} );
			page.on( 'pageerror', ( error ) => {
				consoleErrors.push( error.message );
			} );

			// Mint the bsb_surf nonce the same way a real run does, then
			// request this user page's index (0, the sole saved entry)
			// through the authorized index route -- with bsbTraits present so
			// the surf engine actually boots on it, fidget-heavy so the fake
			// cursor appears promptly regardless of which behavior the
			// auction happens to pick first.
			await page.goto( '/?bsbSession=cockpit' );
			const surfingNonce = await surfNonce( page );

			await page.goto(
				indexUrl( surfingNonce, 0, { bsbTraits: '0,0,0,0,10' } )
			);

			await expect(
				page.locator( 'body.bsb-course-page' )
			).toBeAttached();
			await expect( page.locator( 'h1.wp-block-heading' ) ).toHaveText(
				title
			);

			// Every one of the 3 embeds rendered AND was amended -- not just
			// the first -- proving embed_oembed_html walks and fixes every
			// iframe reaching it on a single real page.
			const embeds = page.locator( 'figure.wp-block-embed' );
			await expect( embeds ).toHaveCount( videoIds.length );
			const iframes = page.locator( 'figure.wp-block-embed iframe' );
			await expect( iframes ).toHaveCount( videoIds.length );

			const srcs = await iframes.evaluateAll( ( elements ) =>
				elements.map( ( el ) => el.getAttribute( 'src' ) ?? '' )
			);
			expect( srcs ).toHaveLength( videoIds.length );
			// The exact origin, not just its presence: YouTube's player posts
			// its messages to that origin, and a wrong one would only surface
			// as an error from YouTube's own frame, which the console check
			// above skips.
			const pageOrigin = new URL( page.url() ).origin;
			for ( const src of srcs ) {
				expect( src ).toMatch( /enablejsapi=1/ );
				expect( src ).toMatch( /mute=1/ );
				expect( new URL( src ).searchParams.get( 'origin' ) ).toBe(
					pageOrigin
				);
				expect( src ).not.toMatch( /autoplay=1/ );
			}

			// The surf engine boots on this page and senses it (the hasVideo
			// affordance, scanning all 3 embeds) without erroring -- the fake
			// cursor appearing is the same boot signal the top-level "Surf
			// engine" describe block uses. WHICH of the 3 embeds the engine
			// actually attends/watches on any given win is decided by
			// DomMotor.playVideo's seeded rng pick; that selection is already
			// covered deterministically at the unit level (Motor.test.ts) and
			// is deliberately NOT asserted here, to avoid a flaky live
			// assertion about which specific video the engine happens to
			// choose.
			await expect( page.locator( '.bsb-surf-cursor' ) ).toBeAttached();

			expect( await page.content() ).not.toMatch( PHP_NOTICE );
			expect( consoleErrors ).toEqual( [] );
		} finally {
			await resetCourseOrder( page );
			await deleteUserPage( page, userPage.id );
		}
	} );

	// Regression coverage for M3's front-end wiring: a real post or page the
	// site owner picked from the settings screen must surf exactly like a
	// bundled page — loaded through the course router's own synthetic-render
	// route (never the real permalink), the surf engine running on it, and
	// the run advancing off its own `bsb:pageDone` — rather than being inert
	// dead weight in the sequence.
	test( 'a user page added via the settings screen appears in the rotation, loads, and advances', async ( {
		page,
	} ) => {
		const title = 'Surf Rotation User Page';
		const userPage = await createUserPage( page, title );

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

			await putUserPageFirst( page, userPage.id );

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
			// surfed — index 0, through the SAME opaque index route a bundled
			// page uses. The client holds no id or slug for it at all; the
			// only thing identifying which page loaded is its own rendered
			// content, checked below.
			await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex=0/ );

			// The router gated the real page in through its controlled
			// route: the surf engine loaded and stamped the shared
			// course-page body-class marker the viewport load guard looks
			// for, so the run treats it as a successful load rather than
			// stopping on it. The real post's own title, prefixed as a
			// heading by `UserPageView`, confirms it is genuinely the user
			// page and not some other entry that happened to resolve to
			// index 0.
			const frame = viewport.contentFrame();
			await expect(
				frame.locator( 'body.bsb-course-page' )
			).toBeAttached();
			await expect( frame.locator( 'h1.wp-block-heading' ) ).toHaveText(
				title
			);
			await expect(
				page.locator( '.bsb-cockpit__viewport-wrap' )
			).toBeVisible();
			await expect( page.locator( '.bsb-summary' ) ).toBeHidden();

			// The engine posts `bsb:pageDone` once it moves on, and the run
			// advances to the next page in the sequence — index 1, the first
			// bundled page (article-1), confirmed the same way: by its own
			// rendered headline, not by anything in the URL.
			await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex=1/, {
				timeout: 30_000,
			} );
			await expect(
				viewport.contentFrame().locator( 'h1.bsb-article__headline' )
			).toHaveText( 'The Hidden Cost of a Browser Tab', {
				timeout: 30_000,
			} );

			expect( await page.content() ).not.toMatch( PHP_NOTICE );
		} finally {
			await resetCourseOrder( page );
			await deleteUserPage( page, userPage.id );
		}
	} );

	// Security regression: the exploit the original fix closed, still true
	// under the index-based redesign. Before the fix, UserPageEngine gated
	// the surf engine onto a user's REAL permalink purely off the presence
	// of the `bsbTraits` URL param — client-controlled input deciding
	// whether the engine ran on a real live page. Appending `?bsbTraits=...`
	// to a selected page's own permalink must do nothing: the engine only
	// ever runs inside the router's controlled `?bsbSurfIndex=<n>` route,
	// itself gated on a `bsb_surf` nonce + capability, never on the real
	// permalink, no matter what query parameters are appended to it.
	test( "visiting a selected user page's real permalink with bsbTraits appended does not inject the surf engine", async ( {
		page,
	} ) => {
		const userPage = await createUserPage(
			page,
			'Security Regression User Page'
		);

		try {
			// Select the page in the saved surf-course order directly through
			// the persistence endpoint (equivalent to having added it via the
			// settings screen and saved), so it is a genuinely eligible,
			// currently-selected user page.
			const response = await page.request.post( SETTINGS_ENDPOINT, {
				headers: { 'X-WP-Nonce': await nonce( page ) },
				data: {
					[ OPTION_KEY ]: [ { kind: 'user', id: userPage.id } ],
				},
			} );
			expect( response.ok() ).toBeTruthy();

			// Visit the page's REAL permalink directly, appending the
			// traits param exactly as the exploit did — no iframe, no
			// router query parameter, just the page's own URL plus the
			// client-controlled param the old gate trusted.
			await page.goto( `${ userPage.link }?bsbTraits=10,0,0,0,0` );

			// Neither the surf engine script nor the shared course-page body
			// class was injected: the real permalink is never a surf target,
			// regardless of what the request carries.
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
		} finally {
			await resetCourseOrder( page );
			await deleteUserPage( page, userPage.id );
		}
	} );
} );

test.describe( 'Security: index route gate', () => {
	// The reinforced requirement: the capability + `bsb_surf` nonce gate
	// guards the ENTIRE `?bsbSurfIndex=` route — every entry it could
	// resolve to, bundled or user alike — because the gate is checked before
	// any entry is even resolved. Index 0 resolves to a perfectly ordinary
	// BUNDLED page (article-1, in the default order these tests run against),
	// so both cases below prove an ordinary bundled page is refused exactly
	// like a user page would be when the gate fails — not served, no
	// `bsb-course-page` body class, no `surfer.js`.

	test( '?bsbSurfIndex=0 with a missing/invalid nonce is not served, even though the requester is authenticated', async ( {
		page,
	} ) => {
		// The project's storage state is an authenticated admin — capability
		// alone must not be enough, the nonce must also be valid.
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

	test( '?bsbSurfIndex=0 as a logged-out request is not served, with no nonce at all', async ( {
		playwright,
		baseURL,
	} ) => {
		// A fresh, cookie-less request context — no admin session, so the
		// capability check fails before the (absent) nonce is even reached.
		const anon = await playwright.request.newContext( { baseURL } );

		const response = await anon.get( '/?bsbSurfIndex=0' );
		const body = await response.text();

		expect( body ).not.toContain( 'bsb-course-page' );
		expect( body ).not.toContain( 'surfer.js' );

		await anon.dispose();
	} );
} );

test.describe( 'Right-to-left rendering', () => {
	test( 'swaps in the mirrored stylesheets but keeps the target battery left-to-right', async ( {
		page,
		baseURL,
	} ) => {
		// Left-to-right first: the original stylesheets, and no twins.
		await page.goto( '/?bsbSession=cockpit' );
		await expect( page.locator( 'html' ) ).not.toHaveAttribute(
			'dir',
			'rtl'
		);
		await expect(
			page.locator( '#battery-surf-bench-style-cockpit-dashboard-css' )
		).toBeAttached();
		await expect(
			page.locator(
				'#battery-surf-bench-style-cockpit-dashboard-rtl-css'
			)
		).toHaveCount( 0 );

		// The same page on a right-to-left site (the Playground's switch, see
		// `forceRtlMuPlugin` in `wp-playground/blueprint.mts`): the document
		// flips, and every plugin stylesheet is replaced by its mirrored twin.
		await page
			.context()
			.addCookies( [
				{ name: FORCE_RTL_COOKIE, value: '1', url: baseURL },
			] );
		await page.goto( '/?bsbSession=cockpit' );
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'dir', 'rtl' );
		await expect(
			page.locator(
				'#battery-surf-bench-style-cockpit-dashboard-rtl-css'
			)
		).toHaveAttribute( 'href', /style-cockpit-dashboard-rtl\.css/ );
		await expect(
			page.locator( '#battery-surf-bench-style-devtools-rtl-css' )
		).toHaveAttribute( 'href', /style-devtools-rtl\.css/ );
		await expect(
			page.locator( '#battery-surf-bench-style-cockpit-dashboard-css' )
		).toHaveCount( 0 );

		// Show the deck, then switch it to target-drop mode so the battery
		// gauge renders.
		await page
			.locator(
				'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
			)
			.first()
			.click();
		await expect(
			page.locator( '.wp-block-bsb-cockpit.is-deck-shown' )
		).toBeAttached();
		await page
			.locator( '.bsb-seg__option[data-mode="targetDrop"]' )
			.click();
		await expect( page.locator( '.bsb-target__battery' ) ).toBeVisible();

		// Drop the target to its minimum, so a fill or handle anchored to the
		// wrong edge would land far from where it belongs.
		await page.locator( '.bsb-target__battery' ).press( 'Home' );
		await expect( page.locator( '.bsb-target__battery' ) ).toHaveAttribute(
			'aria-valuenow',
			'5'
		);

		// The gauge stays left-to-right: the fill grows from the battery's left
		// edge, the handle rides the fill's right end, and the cap sits to the
		// right. Polled, because the deck may still be sliding in and the fill
		// and handle ease to the new value.
		await expect
			.poll( () =>
				page.evaluate( () => {
					const box = ( selector: string ) =>
						document
							.querySelector( selector )!
							.getBoundingClientRect();
					const battery = document.querySelector(
						'.bsb-target__battery'
					)!;
					const inner =
						battery.getBoundingClientRect().left +
						battery.clientLeft;
					const fill = box( '.bsb-target__fill' );
					const handle = box( '.bsb-target__handle' );
					const cap = box( '.bsb-target__cap' );

					return {
						fillStartsAtLeftEdge:
							Math.abs( fill.left - inner ) <= 1,
						handleOnFillEnd:
							Math.abs(
								handle.left + handle.width / 2 - fill.right
							) <= 1,
						capOnTheRight:
							cap.left >=
							battery.getBoundingClientRect().right - 1,
					};
				} )
			)
			.toEqual( {
				fillStartsAtLeftEdge: true,
				handleOnFillEnd: true,
				capOnTheRight: true,
			} );

		await expectNoPhpNotices( page );
	} );

	test( 'keeps the fake cursor on the surf engine’s coordinates on a right-to-left course page', async ( {
		page,
		baseURL,
	} ) => {
		await recordMessages( page );
		await page
			.context()
			.addCookies( [
				{ name: FORCE_RTL_COOKIE, value: '1', url: baseURL },
			] );

		// The sterile engine places the cursor and holds it there until steered,
		// so its position is stable to measure.
		await page.goto( '/?bsbSession=cockpit' );
		const nonce = await surfNonce( page );
		await page.goto(
			indexUrl( nonce, 0, {
				bsbTraits: '0,0,0,0,10',
				bsbSpeed: '1',
				bsbSterile: '1',
			} )
		);
		await waitForMessage( page, 'bsb:pageAffordances' );

		// The course page renders right-to-left, with the mirrored stylesheet.
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'dir', 'rtl' );
		await expect(
			page.locator( '#battery-surf-bench-style-course-rtl-css' )
		).toHaveAttribute( 'href', /style-course-rtl\.css/ );

		// The engine paints the cursor by translating it from the viewport's
		// top-left corner, so its box must sit exactly at that translation. A
		// mirrored stylesheet would anchor it to the right edge instead and push
		// it off-screen.
		const cursor = page.locator( '.bsb-surf-cursor' );
		await expect( cursor ).toBeAttached();
		const placement = await cursor.evaluate( ( el ) => {
			const match = ( el as HTMLElement ).style.transform.match(
				/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/
			);
			const rect = el.getBoundingClientRect();

			return {
				x: match ? parseFloat( match[ 1 ] ) : Number.NaN,
				y: match ? parseFloat( match[ 2 ] ) : Number.NaN,
				left: rect.left,
				top: rect.top,
			};
		} );
		expect( Math.abs( placement.left - placement.x ) ).toBeLessThanOrEqual(
			1
		);
		expect( Math.abs( placement.top - placement.y ) ).toBeLessThanOrEqual(
			1
		);

		await expectNoPhpNotices( page );
	} );
} );
