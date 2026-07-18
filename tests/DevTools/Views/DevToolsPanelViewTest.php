<?php
/**
 * Tests for the dev-tools panel view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\DevTools\Views;

use ErdemBircan\BatterySurfBench\DevTools\Views\DevToolsPanelView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The panel sits outside the cockpit block, so its contract is narrower than a
 * cockpit view: an interactive region bound only to `devtools`-prefixed state
 * and actions (never a `getContext()`-derived getter, since there is no
 * cockpit context here), the pill and card mutually exclusive on
 * `state.devtools.open`, and every raw label the manager hands it escaped
 * into its slot.
 *
 * The battery group has no enable switch: every control already carries its
 * own explicit off-state, so there is nothing for a master switch to gate.
 */
final class DevToolsPanelViewTest extends TestCase {

	/**
	 * The manager relies on every view honouring the shared contract.
	 */
	public function test_is_a_view(): void {
		$this->assertInstanceOf( View::class, new DevToolsPanelView() );
	}

	/**
	 * The pill and the card are mutually exclusive, each bound to the opposite
	 * side of `state.devtools.open`, so the two can never both be visible.
	 */
	public function test_render_binds_the_pill_and_card_mutually_exclusive(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringContainsString( 'data-wp-interactive="bsb/cockpit"', $markup );
		$this->assertStringContainsString(
			'id="bsb-devtools-pill" data-wp-bind--hidden="state.devtools.open"',
			$markup
		);
		$this->assertStringContainsString(
			'id="bsb-devtools-card" hidden data-wp-bind--hidden="!state.devtools.open"',
			$markup
		);
		$this->assertStringContainsString( 'data-wp-bind--aria-expanded="state.devtools.open"', $markup );
		$this->assertStringContainsString( 'aria-controls="bsb-devtools-card"', $markup );
	}

	/**
	 * The pill turns coral, and the card header's "Override active" text
	 * appears, only from the derived `devtoolsIsArmed` getter — which reads
	 * whether a field actually diverges from the system, never a plain
	 * `enabled` flag (there is none any more).
	 */
	public function test_render_wires_the_armed_indicators_to_the_derived_getter(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringContainsString( 'data-wp-class--is-armed="state.devtoolsIsArmed"', $markup );
		$this->assertStringContainsString(
			'data-wp-bind--hidden="!state.devtoolsIsArmed"',
			$markup
		);
	}

	/**
	 * The battery group has no enable switch and no muting: the charging
	 * tri-state and the level row are always live. The level row carries its
	 * own "System" button (the same off-state gesture as the charging
	 * tri-state's System choice) alongside the slider, which drives both its
	 * readout text and its `--fill` track custom property.
	 */
	public function test_render_wires_the_battery_group(): void {
		$markup = ( new DevToolsPanelView() )->render();

		// No switch, no enable action, no muting machinery.
		$this->assertStringNotContainsString( 'devtoolsToggleBatteryEnabled', $markup );
		$this->assertStringNotContainsString( 'battery.enabled', $markup );
		$this->assertStringNotContainsString( 'is-muted', $markup );
		$this->assertStringNotContainsString( 'switch', $markup );
		$this->assertStringNotContainsString( 'devtoolsToggleLevel"', $markup );

		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsSetCharging"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="system"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="charging"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="discharging"', $markup );

		// The level row's own System button clears a dragged-in level.
		$this->assertStringContainsString(
			'data-wp-class--is-selected="!state.devtoolsIsLevelForced"',
			$markup
		);
		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsResetLevel"', $markup );
		$this->assertStringContainsString(
			'data-wp-class--is-inactive="!state.devtoolsIsLevelForced"',
			$markup
		);

		// A forced level is always a multiple of 5 — the slider's own step,
		// backed by the action's defensive snap.
		$this->assertStringContainsString( 'step="5"', $markup );
		$this->assertStringContainsString(
			'data-wp-bind--value="state.devtoolsLevelPercent"',
			$markup
		);
		$this->assertStringContainsString(
			'data-wp-style----fill="state.devtoolsLevelFillPercent"',
			$markup
		);
		$this->assertStringContainsString(
			'data-wp-text="state.devtoolsLevelFillPercent"',
			$markup
		);
		$this->assertStringContainsString( 'data-wp-on--input="actions.devtoolsSetLevel"', $markup );
		$this->assertStringContainsString(
			'data-wp-watch---devtools-persist="callbacks.devtoolsPersist"',
			$markup
		);

		// Clears the Surf tool's steered-behavior state (the group-head
		// countdown, the chip gate) the moment a run stops, driven by the
		// production `runLive` mirror rather than waiting on the sterile
		// engine's own `bsb:behaviorEnd` message — the same panel-root watch
		// convention as `devtoolsPersist`.
		$this->assertStringContainsString(
			'data-wp-watch---devtools-surf-run="callbacks.devtoolsSyncSurfRun"',
			$markup
		);
	}

	/**
	 * While the sim runs, the battery group's tri-state and level row (its
	 * body, not the group's title) are muted, and each interactive control
	 * also carries its own `disabled` binding.
	 */
	public function test_render_mutes_the_battery_group_body_while_the_sim_runs(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringContainsString(
			'class="bsb-devtools__group-body" data-wp-class--is-disabled="state.devtoolsIsSimRunning"',
			$markup
		);
		$this->assertStringContainsString(
			'data-devtools-charging="system" data-wp-class--is-selected="state.devtoolsIsChargingSystem" data-wp-on--click="actions.devtoolsSetCharging" data-wp-bind--disabled="state.devtoolsIsSimRunning"',
			$markup
		);
		$this->assertStringContainsString(
			'data-wp-on--click="actions.devtoolsResetLevel" data-wp-bind--disabled="state.devtoolsIsSimRunning"',
			$markup
		);
		$this->assertStringContainsString(
			'data-wp-on--input="actions.devtoolsSetLevel" data-wp-bind--disabled="state.devtoolsIsSimRunning"',
			$markup
		);
	}

	/**
	 * The Discharge group: three steppers (From/To/Duration) wired to the
	 * shared `devtoolsStepSim` action via `data-devtools-sim-field`/`data-step`,
	 * and a Start/Stop toggle wired to `devtoolsToggleSim`. The steppers are
	 * muted while running (a real running process, not a decorative switch);
	 * the Start/Stop button is deliberately outside that muted wrapper so it
	 * stays live to allow Stop. The group's own head also carries a countdown
	 * span, right-aligned beside its title, shown only while the sim runs.
	 */
	public function test_render_wires_the_discharge_group(): void {
		$markup = ( new DevToolsPanelView() )->render();

		// The title-bar countdown: hidden by default (defensive, pre-hydration),
		// revealed only while the sim is running, reading the formatted
		// remaining-time getter — and appearing exactly once, in the Discharge
		// group's own head, never the Battery group's. The Surf group carries
		// its own countdown span too (same class, different getters — see
		// test_render_wires_the_surf_group), so the bare class name alone is
		// no longer a unique count; the full Discharge-specific binding is.
		$this->assertStringContainsString(
			'class="bsb-devtools__group-countdown" hidden data-wp-bind--hidden="!state.devtoolsIsSimRunning" data-wp-text="state.devtoolsSimRemainingDisplay"',
			$markup
		);
		$this->assertSame(
			1,
			substr_count(
				$markup,
				'data-wp-bind--hidden="!state.devtoolsIsSimRunning" data-wp-text="state.devtoolsSimRemainingDisplay"'
			)
		);

		$this->assertStringContainsString(
			'class="bsb-devtools__sim-steppers" data-wp-class--is-disabled="state.devtoolsIsSimRunning"',
			$markup
		);

		foreach ( array( 'from', 'to', 'minutes' ) as $field ) {
			$this->assertStringContainsString( 'data-devtools-sim-field="' . $field . '" data-step="-5"', $markup );
			$this->assertStringContainsString( 'data-devtools-sim-field="' . $field . '" data-step="5"', $markup );
		}

		$this->assertStringContainsString( 'data-wp-text="state.devtoolsSimFromDisplay"', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.devtoolsSimToDisplay"', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.devtoolsSimMinutesDisplay"', $markup );

		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsStepSim"', $markup );

		// The Start/Stop toggle: a single button, two always-rendered spans,
		// shown/hidden purely via CSS keyed off `is-running` — never a
		// client-side text swap (no JS `__()` extraction wired for this
		// project).
		$this->assertStringContainsString(
			'class="bsb-devtools__sim-toggle" data-wp-class--is-running="state.devtoolsIsSimRunning" data-wp-on--click="actions.devtoolsToggleSim" data-wp-bind--disabled="state.devtoolsIsSimStartBlocked"',
			$markup
		);
		$this->assertStringContainsString( 'bsb-devtools__sim-toggle-text--start', $markup );
		$this->assertStringContainsString( 'bsb-devtools__sim-toggle-text--stop', $markup );

		// The button's own markup carries no `is-disabled` muting — only the
		// steppers wrapper and the battery group body do (asserted above) —
		// so the Start/Stop button stays live while the sim runs.
		$button_tag_start = strpos( $markup, '<button type="button" class="bsb-devtools__sim-toggle"' );
		$this->assertNotFalse( $button_tag_start );
		$button_tag_end = strpos( $markup, '>', $button_tag_start );
		$button_tag     = substr( $markup, $button_tag_start, $button_tag_end - $button_tag_start );
		$this->assertStringNotContainsString( 'is-disabled', $button_tag );

		// Exactly two elements are muted while the sim runs: the battery
		// group's body, and the discharge group's steppers wrapper — never
		// the Start/Stop button or either group's title.
		$this->assertSame(
			2,
			substr_count( $markup, 'data-wp-class--is-disabled="state.devtoolsIsSimRunning"' )
		);
	}

	/**
	 * The card header's third zone — `.bsb-devtools__card-actions` — holds
	 * Reset then Close, after the title and the armed status. Reset is an
	 * icon-only control: its accessible name lives in `aria-label`, its glyph
	 * is an `aria-hidden` masked icon span (the theme's `$icon-reset`), and it
	 * carries no `disabled` binding of any kind — it must stay clickable even
	 * while a sim is running, since stopping the sim is exactly what it is
	 * for. It is only visible once an override is armed, reusing
	 * `state.devtoolsIsArmed` (the same getter already driving the
	 * armed-text span and the pill), starting hidden before hydration like
	 * those other bound elements.
	 */
	public function test_render_wires_the_reset_control(): void {
		$markup = ( new DevToolsPanelView() )->render();

		// The actions container sits after the title and the armed status,
		// and holds Reset before Close.
		$armed_position   = strpos( $markup, 'bsb-devtools__card-armed' );
		$actions_position = strpos( $markup, 'bsb-devtools__card-actions' );
		$reset_position   = strpos( $markup, 'bsb-devtools__card-reset' );
		$close_position   = strpos( $markup, 'bsb-devtools__card-close' );
		$this->assertNotFalse( $armed_position );
		$this->assertNotFalse( $actions_position );
		$this->assertNotFalse( $reset_position );
		$this->assertNotFalse( $close_position );
		$this->assertTrue( $armed_position < $actions_position );
		$this->assertTrue( $actions_position < $reset_position );
		$this->assertTrue( $reset_position < $close_position );

		$button_tag_start = strpos( $markup, '<button type="button" class="bsb-devtools__card-reset"' );
		$this->assertNotFalse( $button_tag_start );
		$button_tag_end = strpos( $markup, '</button>', $button_tag_start );
		$button_tag     = substr( $markup, $button_tag_start, $button_tag_end - $button_tag_start );

		// No visible text label — the accessible name lives in `aria-label`.
		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsReset"', $button_tag );
		$this->assertStringContainsString( 'aria-label="', $button_tag );

		// Hidden until an override is armed: a static `hidden` so it starts
		// hidden before hydration, paired with the bound attribute that
		// reuses the same `devtoolsIsArmed` getter as the armed-text span
		// and the pill.
		$this->assertStringContainsString( ' hidden ', $button_tag );
		$this->assertStringContainsString( 'data-wp-bind--hidden="!state.devtoolsIsArmed"', $button_tag );

		// The glyph is a decorative, masked icon span (themed via
		// `$icon-reset`, not an inline SVG) — hidden from assistive tech
		// since the button itself already carries the accessible name.
		$this->assertStringContainsString( '<span class="bsb-devtools__card-reset-icon"', $button_tag );
		$this->assertStringContainsString( 'aria-hidden="true"', $button_tag );
		$this->assertStringNotContainsString( '<svg', $button_tag );

		// No disabled binding of any kind on the reset button's own markup.
		$this->assertStringNotContainsString( 'disabled', $button_tag );
	}

	/**
	 * The card header's action cluster holds Shark between Reset and Close:
	 * an icon-only control, its accessible name in `aria-label`, its glyph an
	 * `aria-hidden` masked icon span (`$icon-shark-fin`), wired to
	 * `devtoolsReleaseShark` and disabled via `devtoolsSharkDisabled` — the
	 * cockpit's own mirror of whether a shark could actually launch right
	 * now. Unlike Reset it carries no `hidden` binding of its own: it is
	 * always in the row, just disabled outside the launch window. Reset's
	 * visibility is dynamic (only appears once an override is armed), so it
	 * keeps the cluster's outer edge, with Shark and Close — the two
	 * always-present controls — holding their ground beside it.
	 */
	public function test_render_wires_the_shark_control(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$button_tag_start = strpos( $markup, '<button type="button" class="bsb-devtools__card-shark"' );
		$this->assertNotFalse( $button_tag_start );
		$button_tag_end = strpos( $markup, '</button>', $button_tag_start );
		$button_tag     = substr( $markup, $button_tag_start, $button_tag_end - $button_tag_start );

		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsReleaseShark"', $button_tag );
		$this->assertStringContainsString( 'data-wp-bind--disabled="state.devtoolsSharkDisabled"', $button_tag );
		$this->assertStringContainsString( 'aria-label="', $button_tag );
		$this->assertStringContainsString( '<span class="bsb-devtools__card-shark-icon"', $button_tag );
		$this->assertStringContainsString( 'aria-hidden="true"', $button_tag );
		$this->assertStringNotContainsString( '<svg', $button_tag );

		// DOM order: Reset, then Shark, then Close.
		$reset_position = strpos( $markup, 'bsb-devtools__card-reset' );
		$shark_position = strpos( $markup, 'bsb-devtools__card-shark' );
		$close_position = strpos( $markup, 'bsb-devtools__card-close' );
		$this->assertNotFalse( $reset_position );
		$this->assertNotFalse( $shark_position );
		$this->assertNotFalse( $close_position );
		$this->assertTrue( $reset_position < $shark_position );
		$this->assertTrue( $shark_position < $close_position );
	}

	/**
	 * The Surf group: the Natural/Sterile seg (with the Sterile option's coral
	 * modifier class — no hint line underneath it, the seg speaks for itself —
	 * and both options locked for the whole duration of any live run), the
	 * page stepper (its readout showing the real course-page slug), and one
	 * chip per behavior in the given order, each carrying its own
	 * `data-devtools-behavior` key as visible text — with `moveOn` alone
	 * carrying the caution modifier class.
	 */
	public function test_render_wires_the_surf_group(): void {
		$markup = ( new DevToolsPanelView() )->render(
			array(
				'behavior_keys' => array(
					'scrollBurst',
					'readPause',
					'glanceBack',
					'watchVideo',
					'lingerImage',
					'fidgetWiggle',
					'microScroll',
					'selectSnippet',
					'moveOn',
				),
				'course_slugs'  => array( 'article-1', 'gallery', 'video' ),
			)
		);

		// The panel region's own init callback attaches the iframe<->cockpit
		// message listener the Surf tool's countdown/gating state depends on —
		// bound on the same top-level region as the persist watch, so it stays
		// attached for the panel's whole lifetime regardless of open/closed.
		$this->assertStringContainsString(
			'data-wp-init---devtools-surf="callbacks.devtoolsInitSurf"',
			$markup
		);

		// The ordered course-page slugs, emitted as a JSON data attribute on
		// that same region for devtoolsInitSurf() to parse — developer
		// identifiers, escaped for HTML attribute safety but never __()'d.
		$this->assertStringContainsString(
			'data-devtools-course-slugs="' . esc_attr( '["article-1","gallery","video"]' ) . '"',
			$markup
		);

		// The group-head countdown: hidden by default, revealed only while a
		// behavior is steered, reading the countdown display getter.
		$this->assertStringContainsString(
			'class="bsb-devtools__group-countdown" hidden data-wp-bind--hidden="!state.devtoolsSurfIsRunning" data-wp-text="state.devtoolsSurfCountdownDisplay"',
			$markup
		);

		// The Natural/Sterile seg: Sterile carries the coral modifier class,
		// each bound to its own selected-state getter AND locked for the
		// whole duration of any live run (natural or sterile) via the shared
		// devtoolsSurfModeDisabled getter — an enabled seg mid-run would be a
		// lie, since sterile is only ever snapshotted at run start.
		$this->assertStringContainsString(
			'data-devtools-surf-mode="natural" data-wp-class--is-selected="state.devtoolsIsSurfNatural" data-wp-on--click="actions.devtoolsSurfSetMode" data-wp-bind--disabled="state.devtoolsSurfModeDisabled"',
			$markup
		);
		$this->assertStringContainsString(
			'class="bsb-devtools__seg-option bsb-devtools__seg-option--sterile" data-devtools-surf-mode="sterile" data-wp-class--is-selected="state.devtoolsIsSurfSterile" data-wp-on--click="actions.devtoolsSurfSetMode" data-wp-bind--disabled="state.devtoolsSurfModeDisabled"',
			$markup
		);
		$this->assertSame(
			2,
			substr_count( $markup, 'data-wp-bind--disabled="state.devtoolsSurfModeDisabled"' )
		);

		// No hint line: the seg speaks for itself.
		$this->assertStringNotContainsString( 'bsb-devtools__hint', $markup );

		// The page stepper: prev/next arrows around the readout, both
		// disabled while a behavior runs; the readout itself shows the real
		// course-page slug (this manager is environment-gated, so it may
		// safely hand the panel an identifier a production surface never
		// leaks).
		$this->assertStringContainsString(
			'data-step="-1" data-wp-on--click="actions.devtoolsSurfStep" data-wp-bind--disabled="state.devtoolsSurfStepDisabled"',
			$markup
		);
		$this->assertStringContainsString(
			'data-step="1" data-wp-on--click="actions.devtoolsSurfStep" data-wp-bind--disabled="state.devtoolsSurfStepDisabled"',
			$markup
		);
		$this->assertStringContainsString(
			'class="bsb-devtools__stepper-readout bsb-devtools__stepper-readout--slug" data-wp-text="state.devtoolsSurfPageSlug"',
			$markup
		);

		// Nine chips, in the given (engine boot) order, each carrying its own
		// key as plain (untranslated) visible text.
		$keys          = array(
			'scrollBurst',
			'readPause',
			'glanceBack',
			'watchVideo',
			'lingerImage',
			'fidgetWiggle',
			'microScroll',
			'selectSnippet',
			'moveOn',
		);
		$last_position = -1;
		foreach ( $keys as $key ) {
			$this->assertStringContainsString( 'data-devtools-behavior="' . $key . '"', $markup );
			$this->assertStringContainsString( '<span class="bsb-devtools__chip-key">' . $key . '</span>', $markup );
			$position = strpos( $markup, 'data-devtools-behavior="' . $key . '"' );
			$this->assertNotFalse( $position );
			$this->assertGreaterThan( $last_position, $position );
			$last_position = $position;
		}

		// Every chip carries the shared gating/running/duration bindings.
		$this->assertSame(
			9,
			substr_count( $markup, 'data-wp-bind--disabled="state.devtoolsSurfChipDisabled"' )
		);
		$this->assertSame(
			9,
			substr_count( $markup, 'data-wp-class--is-gated="state.devtoolsSurfChipGated"' )
		);
		$this->assertSame(
			9,
			substr_count( $markup, 'data-wp-class--is-running="state.devtoolsSurfChipRunning"' )
		);
		$this->assertSame(
			9,
			substr_count( $markup, 'data-wp-style----chip-dur="state.devtoolsSurfChipDurationCss"' )
		);

		// Only moveOn carries the caution modifier class.
		$this->assertStringContainsString(
			'class="bsb-devtools__chip bsb-devtools__chip--caution" data-devtools-behavior="moveOn"',
			$markup
		);
		$this->assertSame( 1, substr_count( $markup, 'bsb-devtools__chip--caution' ) );
	}

	/**
	 * The Surf group renders no chips at all when no behavior keys are
	 * supplied, rather than erroring — defensive against a missing/malformed
	 * `behavior_keys` value.
	 */
	public function test_render_surf_group_renders_no_chips_when_behavior_keys_is_absent(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringNotContainsString( 'data-devtools-behavior', $markup );
		$this->assertStringContainsString( 'class="bsb-devtools__chips">', $markup );
	}

	/**
	 * The course-slugs data attribute defaults to an empty JSON array — rather
	 * than erroring or emitting nothing — when `course_slugs` is missing or
	 * malformed, defensive the same way `behavior_keys` is.
	 */
	public function test_render_course_slugs_attribute_defaults_to_an_empty_array(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringContainsString( 'data-devtools-course-slugs="[]"', $markup );

		$malformed = ( new DevToolsPanelView() )->render( array( 'course_slugs' => 'not-an-array' ) );

		$this->assertStringContainsString( 'data-devtools-course-slugs="[]"', $malformed );
	}

	/**
	 * Every raw label handed to the view is escaped into its slot.
	 */
	public function test_render_escapes_the_supplied_labels(): void {
		$markup = ( new DevToolsPanelView() )->render(
			array(
				'dev_label'              => '<b>DEV</b>',
				'eyebrow_label'          => '<script>Dev tools</script>',
				'armed_label'            => '<i>Override active</i>',
				'reset_label'            => '"Reset"',
				'close_label'            => '"Close"',
				'shark_label'            => '"Release the shark"',
				'level_label'            => '"Battery level override"',
				'surf_label'             => '<b>Surf</b>',
				'auction_override_label' => '"Auction override"',
				'page_prev_label'        => '"Previous course page"',
				'course_slugs'           => array( '"><script>slug</script>' ),
			)
		);

		$this->assertStringNotContainsString( '<b>DEV</b>', $markup );
		$this->assertStringContainsString( '&lt;b&gt;DEV&lt;/b&gt;', $markup );
		$this->assertStringNotContainsString( '<script>Dev tools</script>', $markup );
		$this->assertStringNotContainsString( '<i>Override active</i>', $markup );
		$this->assertStringContainsString( '&lt;i&gt;Override active&lt;/i&gt;', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Reset&quot;"', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Close&quot;"', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Release the shark&quot;"', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Battery level override&quot;"', $markup );
		$this->assertStringNotContainsString( '<b>Surf</b>', $markup );
		$this->assertStringContainsString( '&lt;b&gt;Surf&lt;/b&gt;', $markup );
		$this->assertStringContainsString(
			'aria-label="&quot;Auction override&quot;"',
			$markup
		);
		$this->assertStringContainsString(
			'aria-label="&quot;Previous course page&quot;"',
			$markup
		);

		// A course slug is a developer identifier, escaped for HTML attribute
		// safety (via the JSON-encode + esc_attr pipeline) but never __()'d.
		$this->assertStringNotContainsString( '<script>slug</script>', $markup );
		$this->assertStringContainsString( '&lt;script&gt;', $markup );
	}
}
