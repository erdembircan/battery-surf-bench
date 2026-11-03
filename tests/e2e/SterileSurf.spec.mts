import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the dev-tools panel's Surf group: arming the
 * "Sterile" override, starting a run under it (the auction never ticks), and
 * firing behaviors manually from the panel to observe them on the live page.
 *
 * The e2e blueprint runs with `WP_ENVIRONMENT_TYPE: 'development'`, so the
 * dev-tools gate is open, and with `WP_DEBUG_DISPLAY`, so a PHP notice prints
 * into the page and fails these tests.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/**
 * Forces discharging through the dev-tools panel (so a run can start
 * regardless of the host's real battery/charging state — the same seam every
 * other cockpit e2e spec that needs a live run already uses).
 *
 * @param page - The page to act on.
 */
async function forceDischarging( page: Page ): Promise< void > {
	await page.locator( '.bsb-devtools__pill' ).click();
	await page.locator( '[data-devtools-charging="discharging"]' ).click();
}

/**
 * Arms the dev-tools Surf tool's "Sterile" override. Assumes the panel card
 * is already open.
 *
 * @param page - The page to act on.
 */
async function armSterile( page: Page ): Promise< void > {
	await page.locator( '[data-devtools-surf-mode="sterile"]' ).click();
}

/**
 * Flips the startup postcard, selects the 4× demo speed (fast enough that an
 * announced dwell resolves well inside this spec's assertion timeouts, but —
 * unlike 10×, whose ~0.8-2s readPause dwell leaves the bark-attribute and
 * disabled-state assertions racing a narrow window — still comfortable: a
 * readPause dwell of ~2-5s), and starts a run. Assumes the dev-tools card has
 * already been closed.
 *
 * @param page - The page to act on.
 */
async function startFastRun( page: Page ): Promise< void > {
	await page
		.locator(
			'.bsb-flipcard--idle .bsb-flipcard__flip[data-wp-on--click="actions.toggleIdleFlip"]'
		)
		.first()
		.click();
	await page
		.locator( '.bsb-seg--speed .bsb-seg__option[data-speed="4"]' )
		.click();
	await page
		.locator( '.bsb-run[data-wp-on--click="actions.toggleRun"]' )
		.click();
}

test.describe( 'Dev-tools Surf group', () => {
	test( 'arming Sterile selects the seg option in coral and reports the panel armed', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		const natural = page.locator( '[data-devtools-surf-mode="natural"]' );
		const sterile = page.locator( '[data-devtools-surf-mode="sterile"]' );
		const armedText = page.locator( '.bsb-devtools__card-armed' );

		await expect( natural ).toHaveClass( /is-selected/ );
		await expect( sterile ).not.toHaveClass( /is-selected/ );
		await expect( armedText ).toBeHidden();

		await sterile.click();

		await expect( sterile ).toHaveClass( /is-selected/ );
		await expect( natural ).not.toHaveClass( /is-selected/ );
		await expect( armedText ).toBeVisible();

		// Collapsing and re-reading the pill confirms the armed tie-in, the
		// same regression guard the battery/discharge tools already carry.
		await page.locator( '.bsb-devtools__card-close' ).click();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toHaveClass(
			/is-armed/
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a natural run keeps the topbar sterile chip hidden', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );

		// The Surf seg was never touched, so this run is natural: the topbar's
		// sterile chip must stay hidden. `.bsb-deck__sterile-chip` sets its own
		// `display`, which — absent an `&[hidden]` guard — silently overrides
		// the `hidden` attribute the state binding correctly applies, so
		// `toBeHidden()` (computed-visibility aware, unlike an attribute check)
		// is the assertion that actually catches the regression.
		await expect(
			page.locator( '.bsb-cockpit__topbar .bsb-deck__sterile-chip' )
		).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a sterile run shows the topbar chip, enables chips once affordances arrive, gates a chip lacking its affordance, steers a behavior (bark + disables while running), and the page stepper navigates', async ( {
		page,
	} ) => {
		test.setTimeout( 60_000 );

		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await armSterile( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );

		// The run is live and sterile: the compact topbar's status head shows
		// the "Sterile" chip.
		const viewport = page.locator( 'iframe.bsb-cockpit__viewport' );
		await expect( viewport ).toHaveAttribute( 'src', /bsbSterile=1/ );
		await expect(
			page.locator( '.bsb-cockpit__topbar .bsb-deck__sterile-chip' )
		).toBeVisible();

		// The panel was closed before the run started; reopen it to reach the
		// chips (the message listener that gates them stays attached
		// regardless — only the card's own visibility toggles).
		await page.locator( '.bsb-devtools__pill' ).click();

		// The Natural/Sterile seg is snapshotted only at run start, so toggling
		// it mid-run would be a lie: both options lock while any run is live.
		const sterileSeg = page.locator(
			'[data-devtools-surf-mode="sterile"]'
		);
		await expect(
			page.locator( '[data-devtools-surf-mode="natural"]' )
		).toBeDisabled();
		await expect( sterileSeg ).toBeDisabled();

		// A disabled seg still shows which choice is active: locking the seg
		// must never make the run's own already-armed Sterile choice look
		// deselected.
		await expect( sterileSeg ).toHaveClass( /is-selected/ );
		await expect( sterileSeg ).toBeVisible();

		// The chips start disabled (no affordances yet) and enable once the
		// sterile page posts them at readiness.
		const scrollBurstChip = page.locator(
			'[data-devtools-behavior="scrollBurst"]'
		);
		await expect( scrollBurstChip ).toBeEnabled( { timeout: 15_000 } );

		// article-1 (the first bundled page) has no video, so watchVideo's own
		// hard affordance gate keeps it disabled even though the panel is
		// otherwise live.
		await expect(
			page.locator( '[data-devtools-behavior="watchVideo"]' )
		).toBeDisabled();

		// Steer readPause: the bark pill appears carrying its key, and the
		// chip disables while it runs (the sequential guard covers every
		// other chip too, asserted via scrollBurst).
		const readPauseChip = page.locator(
			'[data-devtools-behavior="readPause"]'
		);
		await readPauseChip.click();

		await expect( page.locator( '.bsb-cockpit__bark' ) ).toHaveAttribute(
			'data-bark',
			'readPause'
		);
		await expect( readPauseChip ).toBeDisabled();
		await expect( scrollBurstChip ).toBeDisabled();

		// Wait for the steered behavior to resolve (bsb:behaviorEnd), which
		// re-enables every chip.
		await expect( readPauseChip ).toBeEnabled( { timeout: 15_000 } );

		// The page stepper navigates the viewport: clicking next advances the
		// opaque course index from 0 to 1. The readout mirrors the real
		// course-page slug the server resolves that index against (the
		// bundled catalog's default order: article-1, gallery, article-2,
		// video, links) — never a glyph or the raw index.
		const slugReadout = page.locator(
			'.bsb-devtools__stepper-readout--slug'
		);
		await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex=0/ );
		await expect( slugReadout ).toHaveText( 'article-1' );
		await page.locator( '[aria-label="Next course page"]' ).click();
		await expect( viewport ).toHaveAttribute( 'src', /bsbSurfIndex=1/ );
		await expect( slugReadout ).toHaveText( 'gallery' );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'stopping a run mid-behavior clears the group-head countdown even though bsb:behaviorEnd never arrives (the iframe tears down first)', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await armSterile( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );
		await page.locator( '.bsb-devtools__pill' ).click();

		const scrollBurstChip = page.locator(
			'[data-devtools-behavior="scrollBurst"]'
		);
		await expect( scrollBurstChip ).toBeEnabled( { timeout: 15_000 } );

		const groupCountdown = page.locator(
			'[data-wp-text="state.devtoolsSurfCountdownDisplay"]'
		);
		await page.locator( '[data-devtools-behavior="readPause"]' ).click();
		await expect( groupCountdown ).toBeVisible();

		// A live run is compact: the deck (and its `.bsb-run` control) is
		// tucked off-screen, so the control that stops a LIVE run is the
		// compact topbar's own stop button instead. The iframe tears down
		// before the sterile engine can ever post bsb:behaviorEnd, so only
		// the production runLive mirror drives the cleanup.
		await page.locator( '.bsb-deck__readout-stop' ).click();

		await expect( groupCountdown ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	// Regression coverage for the dynamic cursor glyphs (FakeCursor.setMode):
	// the fake cursor swaps its class as the steered behavior moves through
	// its own choreography, not just a static arrow the whole run.
	test( 'steering selectSnippet wears the caret cursor while it runs, then drops it once done', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await armSterile( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );
		await page.locator( '.bsb-devtools__pill' ).click();

		const selectSnippetChip = page.locator(
			'[data-devtools-behavior="selectSnippet"]'
		);
		await expect( selectSnippetChip ).toBeEnabled( { timeout: 15_000 } );

		const cursor = page
			.locator( 'iframe.bsb-cockpit__viewport' )
			.contentFrame()
			.locator( '.bsb-surf-cursor' );

		await selectSnippetChip.click();

		await expect( cursor ).toHaveClass( /bsb-surf-cursor--caret/, {
			timeout: 5_000,
		} );

		// Wait for the steered behavior to resolve (bsb:behaviorEnd), then
		// confirm the caret mode was dropped along with it.
		await expect( selectSnippetChip ).toBeEnabled( { timeout: 15_000 } );
		await expect( cursor ).not.toHaveClass( /bsb-surf-cursor--caret/ );
		await expect( cursor ).not.toHaveClass( /bsb-surf-cursor--hand/ );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	// The highlight's pace is set per character, not per sweep: whichever
	// paragraph the engine picks, it highlights a bounded snippet and takes
	// at least 15 ms per character growing it (the design is 20) — a sweep
	// squeezed into one fixed duration would race a long paragraph through
	// in a fraction of that. Measured in milliseconds: the motor paces by
	// each frame's delta time, so a faster display can't speed it up and a
	// loaded runner only slows it down.
	test( 'steering selectSnippet highlights a bounded snippet at a steady per-character pace', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await armSterile( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );
		await page.locator( '.bsb-devtools__pill' ).click();

		const selectSnippetChip = page.locator(
			'[data-devtools-behavior="selectSnippet"]'
		);
		await expect( selectSnippetChip ).toBeEnabled( { timeout: 15_000 } );

		const coursePage = page
			.locator( 'iframe.bsb-cockpit__viewport' )
			.contentFrame()
			.locator( 'body.bsb-course-page' );

		// Samples the visible length of the page's selection on every
		// animation frame, stamped with the frame's time, from before the
		// steer until the highlight has grown and been cleared again (or
		// 20 s pass with no highlight).
		await coursePage.evaluate( ( body ) => {
			const view = body.ownerDocument.defaultView!;

			(
				view as Window & {
					bsbHighlightSamples?: Promise< [ number, number ][] >;
				}
			 ).bsbHighlightSamples = new Promise< [ number, number ][] >(
				( resolve ) => {
					const samples: [ number, number ][] = [];
					const sample = ( t: number ): void => {
						const length = ( view.getSelection()?.toString() ?? '' )
							.replace( /\s+/g, ' ' )
							.trim().length;
						samples.push( [ t, length ] );

						if (
							length === 0 &&
							samples.some( ( [ , seen ] ) => seen > 0 )
						) {
							resolve( samples );
							return;
						}

						view.requestAnimationFrame( sample );
					};

					view.requestAnimationFrame( sample );
					view.setTimeout( () => resolve( samples ), 20_000 );
				}
			);
		} );

		// The sampler is already running — the evaluate above resolved only
		// once it was installed — so the measured window can't open late.
		await selectSnippetChip.click();

		// Waits for the sampler to see the highlight grow and clear again.
		const samples = await coursePage.evaluate(
			( body ) =>
				(
					body.ownerDocument.defaultView as Window & {
						bsbHighlightSamples?: Promise< [ number, number ][] >;
					}
				 ).bsbHighlightSamples!
		);
		const snippetLength = Math.max(
			...samples.map( ( [ , length ] ) => length )
		);
		const firstSample = samples.find( ( [ , length ] ) => length > 0 )!;
		const fullSample = samples.find(
			( [ , length ] ) => length === snippetLength
		)!;

		// A bounded snippet: never a sliver, never a whole long paragraph.
		expect( snippetLength ).toBeGreaterThanOrEqual( 21 );
		expect( snippetLength ).toBeLessThanOrEqual( 160 );

		// At least 15 ms per character, on average, while it grows.
		expect( fullSample[ 0 ] - firstSample[ 0 ] ).toBeGreaterThanOrEqual(
			snippetLength * 15
		);

		await expect( selectSnippetChip ).toBeEnabled( { timeout: 15_000 } );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'steering watchVideo wears the hand cursor shortly after, without waiting out the full watch dwell', async ( {
		page,
	} ) => {
		test.setTimeout( 60_000 );

		await page.goto( '/?bsbSession=cockpit' );

		await forceDischarging( page );
		await armSterile( page );
		await page.locator( '.bsb-devtools__card-close' ).click();

		await startFastRun( page );
		await page.locator( '.bsb-devtools__pill' ).click();

		const scrollBurstChip = page.locator(
			'[data-devtools-behavior="scrollBurst"]'
		);
		const watchVideoChip = page.locator(
			'[data-devtools-behavior="watchVideo"]'
		);
		const slugReadout = page.locator(
			'.bsb-devtools__stepper-readout--slug'
		);
		await expect( scrollBurstChip ).toBeEnabled( { timeout: 15_000 } );

		// Step from article-1 through to the video page (the bundled
		// catalog's default order: article-1, gallery, article-2, video,
		// links), waiting for each page's own affordances to arrive before
		// advancing again — the stepper itself stays disabled until they do.
		const nextButton = page.locator( '[aria-label="Next course page"]' );
		for ( let step = 0; step < 3; step++ ) {
			await nextButton.click();
			await expect( scrollBurstChip ).toBeEnabled( { timeout: 15_000 } );
		}
		await expect( slugReadout ).toHaveText( 'video' );
		await expect( watchVideoChip ).toBeEnabled( { timeout: 15_000 } );

		const cursor = page
			.locator( 'iframe.bsb-cockpit__viewport' )
			.contentFrame()
			.locator( '.bsb-surf-cursor' );

		await watchVideoChip.click();

		// watchVideo's own dwell is 30-45s (halved by the 4x demo speed to
		// ~7.5-11.25s) — asserting the hand mode arrives promptly is enough;
		// the click ripple's own window is a few hundred ms of real wall
		// time regardless of speed, too narrow a race to assert on reliably
		// against a live browser, so it is deliberately left unasserted here.
		await expect( cursor ).toHaveClass( /bsb-surf-cursor--hand/, {
			timeout: 10_000,
		} );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
