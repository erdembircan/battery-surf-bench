import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for the dev-tools battery-override panel.
 *
 * The e2e blueprint runs with `WP_ENVIRONMENT_TYPE: 'development'`, so the
 * dev-tools gate is open: the floating panel and its script module load on the
 * cockpit dashboard, the same surface a live run happens on (the panel binds
 * only to shared `bsb/cockpit` state, never cockpit context, so it works
 * exactly the same whichever course page the viewport happens to be surfing).
 * The blueprint enables `WP_DEBUG_DISPLAY`, so a PHP notice prints into the
 * page and fails these tests.
 *
 * The battery group has no enable switch: the charging tri-state and the
 * level row are always live, each carrying its own explicit "System" off-state.
 */

/** PHP error/warning/notice text WordPress prints when WP_DEBUG_DISPLAY is on. */
const PHP_NOTICE = /Warning:|Notice:|Deprecated:|Fatal error:|has no effect/;

/**
 * Flips the startup postcard and starts a run in the default (duration) mode.
 *
 * @param page - The page to act on.
 */
async function startRun( page: Page ): Promise< void > {
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

test.describe( 'Dev-tools battery-override panel', () => {
	test( 'the pill and card are mutually exclusive, collapsed by default', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await expect( page.locator( '.bsb-devtools' ) ).toBeAttached();

		// Closed: the pill is on screen, the card is not.
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeHidden();

		await page.locator( '.bsb-devtools__pill' ).click();

		// Open: the swap, never both — the pill is now hidden, the card visible.
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeHidden();

		await page.locator( '.bsb-devtools__card-close' ).click();

		// Closing swaps back.
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'opening the panel feels near-instant — the pill is gone well under the old 220ms swap', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		const pill = page.locator( '.bsb-devtools__pill' );
		await pill.click();

		// The pill must already be hidden almost immediately — hiding carries no
		// transition/delay of its own, so this should resolve well inside a
		// budget that would have failed under the old 220ms fade-then-hide
		// sequencing.
		await expect( pill ).toBeHidden( { timeout: 150 } );
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeVisible( {
			timeout: 150,
		} );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the battery group has no enable step — the charging tri-state and level row are always live', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeVisible();

		// No switch of any kind in the battery group.
		await expect(
			page.locator( '.bsb-devtools__group input[type="checkbox"]' )
		).toHaveCount( 0 );

		// Charging is directly clickable with no prior step.
		await page.locator( '[data-devtools-charging="discharging"]' ).click();
		await expect(
			page.locator( '[data-devtools-charging="discharging"]' )
		).toHaveClass( /is-selected/ );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'dragging the level slider arms the override directly; the System button clears it — pill ties in', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		const levelRow = page.locator( '.bsb-devtools__level' );
		const levelSystemButton = levelRow.locator(
			'.bsb-devtools__seg-option'
		);
		const slider = levelRow.locator( 'input[type="range"]' );
		const armedText = page.locator( '.bsb-devtools__card-armed' );

		// Following the system by default: the row reads inactive, the System
		// choice selected, nothing armed.
		await expect( levelRow ).toHaveClass( /is-inactive/ );
		await expect( levelSystemButton ).toHaveClass( /is-selected/ );
		await expect( armedText ).toBeHidden();

		// Dragging the slider is itself the override — no toggle to flip first.
		await slider.fill( '20' );
		await slider.dispatchEvent( 'input' );

		await expect( levelRow ).not.toHaveClass( /is-inactive/ );
		await expect( levelSystemButton ).not.toHaveClass( /is-selected/ );
		await expect( armedText ).toBeVisible();

		// Collapsing and re-reading the pill confirms the armed tie-in.
		await page.locator( '.bsb-devtools__card-close' ).click();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toHaveClass(
			/is-armed/
		);

		// The level row's own System button clears the forced value.
		await page.locator( '.bsb-devtools__pill' ).click();
		await levelSystemButton.click();

		await expect( levelRow ).toHaveClass( /is-inactive/ );
		await expect( levelSystemButton ).toHaveClass( /is-selected/ );
		await expect( armedText ).toBeHidden();
		await page.locator( '.bsb-devtools__card-close' ).click();
		await expect( page.locator( '.bsb-devtools__pill' ) ).not.toHaveClass(
			/is-armed/
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the level readout stays inside the card at every value, and the slider snaps to 5% steps', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		const card = page.locator( '.bsb-devtools__card' );
		const slider = page.locator(
			'.bsb-devtools__level input[type="range"]'
		);
		const value = page.locator( '.bsb-devtools__level-value' );

		// `step="5"` means only multiples of 5 are fillable at all (Playwright
		// rejects a non-step value as malformed, same as a real drag snapping)
		// — the unit tests cover the defensive rounding for a raw, off-step
		// value arriving some other way.
		for ( const percent of [ 0, 10, 55, 100 ] ) {
			await slider.fill( String( percent ) );
			await slider.dispatchEvent( 'input' );
			await expect( value ).toHaveText( `${ percent }%` );

			// The readout's box never extends past the card's own box — no
			// horizontal overflow at any digit count.
			const cardBox = await card.boundingBox();
			const valueBox = await value.boundingBox();
			expect( cardBox ).not.toBeNull();
			expect( valueBox ).not.toBeNull();
			if ( cardBox && valueBox ) {
				expect( valueBox.x + valueBox.width ).toBeLessThanOrEqual(
					cardBox.x + cardBox.width + 0.5
				);
			}
		}

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the level row mirrors the live system battery percentage while following it', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// The cockpit's own battery readout is the raw system reading; the
		// dev-tools level row (still on System) must show that same figure,
		// not a hardcoded placeholder — proving `state.batterySystemPercent`
		// reached the panel, which has no cockpit context of its own. The
		// readout is bound in both the full deck and the compact top pill, so
		// take the first (both must agree with each other anyway).
		const cockpitReading = page
			.locator( '[data-wp-text="state.batteryDisplay"]' )
			.first();
		await expect( cockpitReading ).not.toHaveText( '—' );
		const systemPercent = await cockpitReading.textContent();

		await page.locator( '.bsb-devtools__pill' ).click();
		const levelValue = page.locator( '.bsb-devtools__level-value' );

		await expect( levelValue ).toHaveText( `${ systemPercent }%` );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'forcing Discharging lets a run start and keep surfing, forcing Charging stops it with the plugged reason', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		// Open the panel and force discharging directly — no enable step.
		await page.locator( '.bsb-devtools__pill' ).click();
		await page.locator( '[data-devtools-charging="discharging"]' ).click();
		await expect(
			page.locator( '[data-devtools-charging="discharging"]' )
		).toHaveClass( /is-selected/ );

		await startRun( page );

		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeVisible();
		await expect(
			page.locator( 'iframe.bsb-cockpit__viewport' )
		).toHaveAttribute( 'src', /bsbSessionPage/ );

		// The run keeps surfing — it is not immediately undone by the host's own
		// real charging state.
		await page.waitForTimeout( 500 );
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeVisible();
		await expect( page.locator( '.bsb-summary' ) ).toBeHidden();

		// Forcing charging re-applies immediately (no reload, no waiting for the
		// next real battery event) and stops the run with the plugged reason.
		await page.locator( '[data-devtools-charging="charging"]' ).click();

		await expect( page.locator( '.bsb-summary' ) ).toBeVisible();
		await expect( page.locator( '.bsb-summary__head' ) ).toHaveText(
			'Plugged back in.'
		);
		await expect(
			page.locator( '.bsb-cockpit__viewport-wrap' )
		).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a persisted level override positions the slider thumb after a reload', async ( {
		page,
	} ) => {
		// Seed the persisted devtools slice (the current v4 shape — `open` and
		// `battery` only, no discharge-sim fields) before any module runs, as a
		// prior session would have left it.
		await page.addInitScript( () => {
			window.localStorage.setItem(
				'bsb-devtools-v4',
				JSON.stringify( {
					open: true,
					battery: { charging: null, level: 0.3 },
				} )
			);
		} );

		await page.goto( '/?bsbSession=cockpit' );

		// Pins the range input's `data-wp-bind--value` behavior: under the
		// installed Interactivity version the binding sets the input's value
		// PROPERTY (which positions the thumb), so the slider must sit at the
		// persisted 30 — not the browser-default 50 — while the readout span
		// shows the same figure. If a future Interactivity version regresses
		// this to an attribute-only (no-op) bind, this assertion catches it.
		const slider = page.locator(
			'.bsb-devtools__level input[type="range"]'
		);
		await expect( slider ).toHaveValue( '30' );
		await expect( page.locator( '.bsb-devtools__level-value' ) ).toHaveText(
			'30%'
		);
		await expect( page.locator( '.bsb-devtools__pill' ) ).toHaveClass(
			/is-armed/
		);

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'a value stored under an old (pre-Milestone-3) key is ignored', async ( {
		page,
	} ) => {
		// The v1 shape carried a now-removed `enabled` flag; the v2 shape had no
		// `sim` field at all; the v3 shape carried a `sim` field the panel would
		// resume a running sim from. The current code reads only
		// `bsb-devtools-v4`, so every stale blob is never looked up — the panel
		// starts fresh at its defaults instead of inheriting anything from them.
		await page.addInitScript( () => {
			window.localStorage.setItem(
				'bsb-devtools-v1',
				JSON.stringify( {
					open: true,
					battery: { enabled: true, charging: true, level: 0.9 },
				} )
			);
			window.localStorage.setItem(
				'bsb-devtools-v2',
				JSON.stringify( {
					open: true,
					battery: { charging: true, level: 0.9 },
				} )
			);
			window.localStorage.setItem(
				'bsb-devtools-v3',
				JSON.stringify( {
					open: true,
					battery: { charging: true, level: 0.9 },
					sim: {
						fromPercent: 90,
						toPercent: 20,
						minutes: 30,
						running: true,
						startedAt: Date.now() - 60_000,
					},
				} )
			);
		} );

		await page.goto( '/?bsbSession=cockpit' );

		// Defaults: collapsed, unarmed — none of the stale blobs had any effect.
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__pill' ) ).not.toHaveClass(
			/is-armed/
		);
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the discharge sim never persists and never resumes across a reload', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		const toggle = page.locator( '.bsb-devtools__sim-toggle' );
		await toggle.click();
		await expect( toggle ).toHaveClass( /is-running/ );

		// The persisted blob never carries a `sim` field, whether the sim was
		// ever started or not. Poll briefly for the reactive persist watcher
		// to have caught up with the click.
		await expect
			.poll( () =>
				page.evaluate(
					( key ) => window.localStorage.getItem( key ),
					'bsb-devtools-v4'
				)
			)
			.not.toBeNull();
		const stored = await page.evaluate(
			( key ) => window.localStorage.getItem( key ),
			'bsb-devtools-v4'
		);
		expect( JSON.parse( stored ?? '{}' ) ).not.toHaveProperty( 'sim' );

		await page.reload();

		// The reload starts a fresh session: the sim is not running, and the
		// panel reopens (from the persisted `open`) without resuming anything.
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeVisible();
		await expect(
			page.locator( '.bsb-devtools__sim-toggle' )
		).not.toHaveClass( /is-running/ );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'starting the discharge sim moves the level and mutes every other battery control, leaving Stop live', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		// Shorten the run to 5 minutes (the minimum) so the ticker's first tick
		// produces a visibly different level within the test's own wait.
		const minutesDecrease = page.locator(
			'[data-devtools-sim-field="minutes"][data-step="-5"]'
		);
		for ( let i = 0; i < 5; i++ ) {
			await minutesDecrease.click();
		}
		await expect(
			page.locator( '[data-wp-text="state.devtoolsSimMinutesDisplay"]' )
		).toHaveText( '5' );

		const levelValue = page.locator( '.bsb-devtools__level-value' );
		const startLevel = await levelValue.textContent();

		const toggle = page.locator( '.bsb-devtools__sim-toggle' );
		await toggle.click();

		// Running: the toggle reads Stop, and stays enabled/clickable.
		await expect( toggle ).toHaveClass( /is-running/ );
		await expect( toggle ).toBeEnabled();

		// Every other battery-related control is muted while the sim runs: the
		// battery group's body (charging tri-state + level row — the first
		// `.bsb-devtools__group-body`, the Battery group being rendered before
		// Discharge), and the sim's own steppers — never the Start/Stop button.
		await expect(
			page.locator( '.bsb-devtools__group-body' ).first()
		).toHaveClass( /is-disabled/ );
		await expect(
			page.locator( '.bsb-devtools__sim-steppers' )
		).toHaveClass( /is-disabled/ );
		await expect(
			page.locator( '[data-devtools-charging="system"]' )
		).toBeDisabled();
		await expect(
			page.locator( '.bsb-devtools__level input[type="range"]' )
		).toBeDisabled();
		await expect( minutesDecrease ).toBeDisabled();

		// The level readout starts moving toward the configured end (20%),
		// forced by the sim seeding the override immediately on start.
		await expect( levelValue ).not.toHaveText( startLevel ?? '' );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'stopping the discharge sim freezes the overrides in place and unmutes every control', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		const minutesDecrease = page.locator(
			'[data-devtools-sim-field="minutes"][data-step="-5"]'
		);
		for ( let i = 0; i < 5; i++ ) {
			await minutesDecrease.click();
		}

		const toggle = page.locator( '.bsb-devtools__sim-toggle' );
		await toggle.click();
		await expect( toggle ).toHaveClass( /is-running/ );

		// Let the ticker run for a moment so the level has actually moved off
		// its seeded starting value.
		await page.waitForTimeout( 1500 );

		const levelValue = page.locator( '.bsb-devtools__level-value' );
		const frozenLevel = await levelValue.textContent();

		await toggle.click();

		// Stopped: the toggle reads Start again, every control unmutes.
		await expect( toggle ).not.toHaveClass( /is-running/ );
		await expect(
			page.locator( '.bsb-devtools__group-body' ).first()
		).not.toHaveClass( /is-disabled/ );
		await expect(
			page.locator( '.bsb-devtools__sim-steppers' )
		).not.toHaveClass( /is-disabled/ );
		await expect(
			page.locator( '[data-devtools-charging="system"]' )
		).toBeEnabled();
		await expect(
			page.locator( '.bsb-devtools__level input[type="range"]' )
		).toBeEnabled();
		await expect( minutesDecrease ).toBeEnabled();

		// The overrides stay frozen exactly where they were — no reset, and no
		// further movement now the ticker is stopped.
		await page.waitForTimeout( 1500 );
		await expect( levelValue ).toHaveText( frozenLevel ?? '' );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'Reset clears every override in one click, including stopping a running discharge sim', async ( {
		page,
	} ) => {
		await page.goto( '/?bsbSession=cockpit' );

		await page.locator( '.bsb-devtools__pill' ).click();

		// Arm a charging override.
		await page.locator( '[data-devtools-charging="charging"]' ).click();
		await expect(
			page.locator( '[data-devtools-charging="charging"]' )
		).toHaveClass( /is-selected/ );

		// Shorten the run so the ticker's first tick moves the level within the
		// test's own wait, then start the discharge sim.
		const minutesDecrease = page.locator(
			'[data-devtools-sim-field="minutes"][data-step="-5"]'
		);
		for ( let i = 0; i < 5; i++ ) {
			await minutesDecrease.click();
		}
		const toggle = page.locator( '.bsb-devtools__sim-toggle' );
		await toggle.click();
		await expect( toggle ).toHaveClass( /is-running/ );

		const armedText = page.locator( '.bsb-devtools__card-armed' );
		await expect( armedText ).toBeVisible();

		await page.locator( '.bsb-devtools__card-reset' ).click();

		// Sim stopped: the toggle shows the Start state again.
		await expect( toggle ).not.toHaveClass( /is-running/ );

		// Charging back to System.
		await expect(
			page.locator( '[data-devtools-charging="system"]' )
		).toHaveClass( /is-selected/ );

		// No override armed any more.
		await expect( armedText ).toBeHidden();

		// Steppers restored to their 90/20/30 defaults.
		await expect(
			page.locator( '[data-wp-text="state.devtoolsSimFromDisplay"]' )
		).toHaveText( '90' );
		await expect(
			page.locator( '[data-wp-text="state.devtoolsSimToDisplay"]' )
		).toHaveText( '20' );
		await expect(
			page.locator( '[data-wp-text="state.devtoolsSimMinutesDisplay"]' )
		).toHaveText( '30' );

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );

	test( 'the panel also loads on the stored-session detail screen', async ( {
		page,
	} ) => {
		const nonce = (
			await (
				await page.request.get(
					'/wp-admin/admin-ajax.php?action=rest-nonce'
				)
			).text()
		).trim();
		const created = await page.request.post( '/wp-json/wp/v2/bsb_session', {
			headers: { 'X-WP-Nonce': nonce },
			data: {
				status: 'publish',
				meta: {
					bsb_status: 'finished',
					bsb_mode: 'duration',
					bsb_started_at: '2026-06-23T10:00:00.000Z',
					bsb_ended_at: '2026-06-23T10:30:00.000Z',
					bsb_start_level: 0.9,
					bsb_end_level: 0.8,
					bsb_dropped_pct: 10,
					bsb_elapsed: 1800,
					bsb_config_mode: 'duration',
				},
			},
		} );
		expect( created.status() ).toBe( 201 );
		const id = ( await created.json() ).id as number;

		await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );

		await expect( page.locator( '.bsb-devtools' ) ).toBeAttached();
		await expect( page.locator( '.bsb-devtools__pill' ) ).toBeVisible();
		await expect( page.locator( '.bsb-devtools__card' ) ).toBeHidden();

		expect( await page.content() ).not.toMatch( PHP_NOTICE );
	} );
} );
