<?php
/**
 * Tests for the cockpit block view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The block view renders the cockpit's front-end markup from the already-escaped
 * values the render template hands it. Its contract: emit the Interactivity
 * region with the supplied wrapper attributes and context, and wire the
 * controls and viewport to the store directives the client view binds to.
 */
final class CockpitViewTest extends TestCase {

	/**
	 * The view honours the shared View contract the render template depends on.
	 */
	public function test_is_a_view(): void {
		$this->assertInstanceOf( View::class, new CockpitView() );
	}

	/**
	 * The supplied wrapper attributes and per-instance context are placed onto
	 * the interactive region, and the viewport carries the store directives the
	 * client view (view.ts) hydrates against.
	 */
	public function test_render_wires_the_interactive_region(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-interactive="bsb/cockpit"', $markup );
		$this->assertStringContainsString( 'data-wp-init="callbacks.initTheme"', $markup );
		$this->assertStringContainsString( 'data-wp-init---battery="callbacks.initBattery"', $markup );
		$this->assertStringContainsString( 'data-wp-init---wake-lock="callbacks.initWakeLock"', $markup );
		$this->assertStringContainsString( 'data-wp-watch---run-activity="callbacks.syncRunActivity"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--data-theme="context.theme"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-compact="state.isCompact"', $markup );
		$this->assertStringContainsString( 'class="wp-block-bsb-cockpit"', $markup );
		$this->assertStringContainsString( 'data-wp-context=\'{"activeIndex":0}\'', $markup );
		$this->assertStringContainsString( 'data-wp-bind--src="state.currentSrc"', $markup );
		$this->assertStringContainsString( 'title="Surf viewport"', $markup );
	}

	/**
	 * The viewport iframe is covered by an interaction shield so the benchmarked
	 * page is shown but cannot be interacted with. The shield is a sibling of the
	 * iframe inside a shared positioned wrapper and is hidden from assistive tech,
	 * and a "view only" chip names the state to sighted users.
	 */
	public function test_render_shields_the_viewport_from_interaction(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'class="bsb-cockpit__viewport-wrap"', $markup );
		$this->assertStringContainsString( 'class="bsb-cockpit__shield" aria-hidden="true"', $markup );
		$this->assertStringContainsString( 'class="bsb-cockpit__shield-badge"', $markup );
		$this->assertStringContainsString( 'View only while the run is surfing', $markup );
	}

	/**
	 * Before a run the stage shows the idle postcard, not the iframe: the idle
	 * screen is hidden while running and the viewport-wrap (shipped hidden) is
	 * hidden while idle, so the benchmarked page never loads on the idle screen.
	 */
	public function test_render_shows_the_idle_postcard_until_running(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'class="bsb-cockpit__idle" data-wp-bind--hidden="state.isRunning"', $markup );
		$this->assertStringContainsString( 'class="bsb-cockpit__viewport-wrap" hidden data-wp-bind--hidden="state.isIdle"', $markup );
		$this->assertStringContainsString( 'class="bsb-cockpit__postcard-mark"', $markup );
		$this->assertStringContainsString( 'class="bsb-cockpit__stamp"', $markup );
		$this->assertStringContainsString( 'How this run works', $markup );
		$this->assertStringContainsString( 'Greetings from', $markup );
		$this->assertStringContainsString( 'Set the session', $markup );
		// The keep-the-screen-awake notice rides on the postcard.
		$this->assertStringContainsString( 'class="bsb-cockpit__postcard-notice"', $markup );
		$this->assertStringContainsString( 'Keep the laptop open', $markup );
	}

	/**
	 * The run summary is a flip card shown only once a run has ended, with its
	 * report bound to the store and a flip control that turns the card.
	 */
	public function test_render_includes_the_run_summary_flip_card(): void {
		$markup = $this->render();

		// Shown only when a run has ended.
		$this->assertStringContainsString( 'class="bsb-summary" hidden data-wp-bind--hidden="!state.isEnded"', $markup );
		// The 3D card turns on the flipped state.
		$this->assertStringContainsString( 'data-wp-class--is-flipped="state.isFlipped"', $markup );
		// The flip indicator turns the card.
		$this->assertStringContainsString( 'data-wp-on--click="actions.toggleFlip"', $markup );
		// The verdict heading binds to the store; the SVG is painted imperatively
		// by a watch (directives cannot live inside SVG during server render).
		$this->assertStringContainsString( 'data-wp-text="state.summaryHeading"', $markup );
		$this->assertStringContainsString( 'data-wp-watch="callbacks.renderSummary"', $markup );
		$this->assertStringContainsString( 'class="bsb-summary__chart-line"', $markup );
		// The summary's drain graph hides when there is nothing to plot.
		$this->assertStringContainsString( 'data-wp-bind--hidden="!state.hasGraph"', $markup );
		// New run restarts via the run toggle.
		$this->assertStringContainsString( 'class="bsb-summary__new" data-wp-on--click="actions.toggleRun"', $markup );
	}

	/**
	 * The control deck wires the mode segmented control to the store: each option
	 * names its mode, calls `actions.selectMode`, and reflects the active mode.
	 */
	public function test_render_wires_the_mode_control(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-mode="duration"', $markup );
		$this->assertStringContainsString( 'data-mode="targetDrop"', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.selectMode"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-active="state.isModeDuration"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-active="state.isModeTargetDrop"', $markup );
		$this->assertStringContainsString( '>Duration<', $markup );
		$this->assertStringContainsString( '>Target drop<', $markup );
	}

	/**
	 * The duration field is hidden unless duration mode is active; its stepper
	 * steps the duration, the value reads back to assistive tech, and the visual
	 * odometer is wired to the store's roll watch.
	 */
	public function test_render_wires_the_duration_control(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-bind--hidden="state.isModeTargetDrop"', $markup );
		$this->assertStringContainsString( 'data-step="-5"', $markup );
		$this->assertStringContainsString( 'data-step="5"', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.stepDuration"', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.durationDisplay"', $markup );
		$this->assertStringContainsString( 'class="bsb-odometer" data-wp-watch="callbacks.rollDuration"', $markup );
		$this->assertStringContainsString( 'class="bsb-odometer__cell"', $markup );
	}

	/**
	 * The target-drop field is hidden in duration mode; its battery is a custom
	 * slider whose fill width and colour come from the store, driven by pointer
	 * and keyboard actions.
	 */
	public function test_render_wires_the_target_control(): void {
		$markup = $this->render();

		// Hidden in the server markup (default duration mode) so it doesn't flash
		// before hydration, then bound to the store for live mode switches.
		$this->assertStringContainsString( 'class="bsb-field bsb-field--target" hidden data-wp-bind--hidden="state.isModeDuration"', $markup );
		$this->assertStringContainsString( 'role="slider"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--aria-valuenow="context.targetPercent"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--aria-valuemax="state.targetCap"', $markup );
		$this->assertStringContainsString( 'data-wp-on--pointerdown="actions.targetPointerDown"', $markup );
		$this->assertStringContainsString( 'data-wp-on--keydown="actions.targetKeyDown"', $markup );
		$this->assertStringContainsString( 'data-wp-style--width="state.targetDisplay"', $markup );
		$this->assertStringContainsString( 'data-wp-style--background="state.targetColor"', $markup );
	}

	/**
	 * The baseline toggle binds its checked state to context and reports changes
	 * back through `actions.toggleBaseline`.
	 */
	public function test_render_wires_the_baseline_toggle(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-bind--checked="context.baseline"', $markup );
		$this->assertStringContainsString( 'data-wp-on--change="actions.toggleBaseline"', $markup );
		$this->assertStringContainsString( '>Baseline calibration<', $markup );
	}

	/**
	 * The speed segmented control names each multiplier, calls
	 * `actions.selectSpeed`, and reflects the active speed.
	 */
	public function test_render_wires_the_speed_control(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-speed="1"', $markup );
		$this->assertStringContainsString( 'data-speed="4"', $markup );
		$this->assertStringContainsString( 'data-speed="10"', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.selectSpeed"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-active="state.isSpeed1"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-active="state.isSpeed4"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-active="state.isSpeed10"', $markup );
	}

	/**
	 * The readouts pill binds the battery level, colour, charging bolt and
	 * metrics to the store; its waves scale their scroll rate by the run's demo
	 * speed.
	 */
	public function test_render_wires_the_readouts(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-text="state.batteryDisplay"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-charging="state.isCharging"', $markup );
		$this->assertStringContainsString( 'class="bsb-stat__bolt"', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.timeToEmptyDisplay"', $markup );
		$this->assertStringContainsString( 'data-wp-style----bsb-wave-speed="context.speed"', $markup );
	}

	/**
	 * The run control toggles the run, reflects the running and charge-blocked
	 * states for its Start/Stop/Plugged-in swap, disables itself while blocked,
	 * and carries all three translated labels.
	 */
	public function test_render_wires_the_run_control(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-on--click="actions.toggleRun"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-running="state.isRunning"', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-blocked="state.isStartBlocked"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--disabled="state.isStartBlocked"', $markup );
		$this->assertStringContainsString( '>Start</span>', $markup );
		$this->assertStringContainsString( '>Stop</span>', $markup );
		$this->assertStringContainsString( '>Plugged in</span>', $markup );
	}

	/**
	 * The config controls and the readouts pill are wrapped in one swap group
	 * that reflects the running state, so they can slide past each other when a
	 * run starts or stops.
	 */
	public function test_render_groups_config_and_pill_for_the_swap(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'class="bsb-deck__swap" data-wp-class--is-running="state.isRunning"', $markup );
		$this->assertStringContainsString( 'class="bsb-deck__config"', $markup );
	}

	/**
	 * The surfing indicator reads the run clock from the store and frames it with
	 * the mode-dependent "elapsed"/"left" words (each shown for its mode), and the
	 * pill shows the target readout only in target-drop mode.
	 */
	public function test_render_wires_the_surfing_indicator(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-text="state.runClock"', $markup );
		$this->assertStringContainsString( '<span data-wp-bind--hidden="state.isModeDuration">elapsed</span>', $markup );
		$this->assertStringContainsString( '<span data-wp-bind--hidden="state.isModeTargetDrop">left</span>', $markup );
		$this->assertStringContainsString( 'Surfing', $markup );

		// The target readout is shown only in target-drop mode.
		$this->assertStringContainsString( 'class="bsb-stat bsb-stat--target" data-wp-bind--hidden="state.isModeDuration"', $markup );
	}

	/**
	 * The theme toggle cycles the preference through `actions.toggleTheme`,
	 * reflects the current preference for its icon, and carries its accessible
	 * label so the deck can switch between light, dark and system themes.
	 */
	public function test_render_wires_the_theme_toggle(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'class="bsb-deck__theme"', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.toggleTheme"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--data-pref="context.themePref"', $markup );
		$this->assertStringContainsString( 'aria-label="Toggle light or dark theme"', $markup );
	}

	/**
	 * Compact mode: a chevron in the deck toggles it (shown only mid-run), and a
	 * second readouts pill sits in the stage as the top bar with its own stop and
	 * expand controls. Both pills bind to the same store readings.
	 */
	public function test_render_wires_compact_mode(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'class="bsb-deck__compact" data-wp-on--click="actions.toggleCompact" data-wp-class--is-hidden="state.isIdle"', $markup );
		$this->assertStringContainsString( 'class="bsb-cockpit__topbar"', $markup );
		$this->assertStringContainsString( 'class="bsb-deck__readout-stop" data-wp-on--click="actions.toggleRun"', $markup );
		$this->assertStringContainsString( 'class="bsb-deck__expand" data-wp-on--click="actions.toggleCompact"', $markup );

		// The readouts pill is rendered in both the deck and the top bar — its
		// charging-bolt binding therefore appears twice.
		$this->assertSame( 2, substr_count( $markup, 'data-wp-class--is-charging="state.isCharging"' ) );
	}

	/**
	 * Renders the view with a full set of escaped values, as the render template
	 * supplies them.
	 *
	 * @return string The rendered cockpit markup.
	 */
	private function render(): string {
		return ( new CockpitView() )->render(
			array(
				'wrapper'            => 'class="wp-block-bsb-cockpit"',
				'context'            => 'data-wp-context=\'{"activeIndex":0}\'',
				'brand_title'        => 'Battery Surf Bench',
				'brand_subtitle'     => 'Cockpit',
				'theme_label'        => 'Toggle light or dark theme',
				'mode_label'         => 'Mode',
				'duration_mode'      => 'Duration',
				'target_drop_mode'   => 'Target drop',
				'duration_label'     => 'Run duration',
				'minutes_label'      => 'min',
				'decrease_label'     => 'Decrease duration',
				'increase_label'     => 'Increase duration',
				'target_label'       => 'Stop at battery',
				'target_aria'        => 'Target battery percentage',
				'baseline_label'     => 'Baseline calibration',
				'speed_label'        => 'Speed',
				'battery_label'      => 'Battery',
				'rate10_label'       => 'Rate · 10 min',
				'rate_session_label' => 'Rate · session',
				'tte_label'          => '100% → 0%',
				'target_short_label' => 'Target',
				'surfing_label'      => 'Surfing',
				'elapsed_label'      => 'elapsed',
				'remaining_label'    => 'left',
				'start_label'        => 'Start',
				'stop_label'         => 'Stop',
				'plugged_label'      => 'Plugged in',
				'compact_label'      => 'Compact the dashboard',
				'expand_label'       => 'Expand the dashboard',
				'viewport_title'     => 'Surf viewport',
				'shield_label'       => 'View only while the run is surfing',
				'greeting_lead'      => 'Greetings from',
				'idle_heading'       => 'How this run works',
				'idle_subtitle'      => 'a controlled, repeatable battery run.',
				'idle_step1_title'   => 'Set the session',
				'idle_step1_text'    => 'Pick a run length, or a battery % to stop at.',
				'idle_step2_title'   => 'Drop in',
				'idle_step2_text'    => 'Hit Start. The charger unplugs and the run begins on its own.',
				'idle_step3_title'   => 'Watch the slope',
				'idle_step3_text'    => 'It runs hands-free while the battery drains; you just watch the numbers.',
				'idle_notice_title'  => 'Keep the laptop open',
				'idle_notice_text'   => 'The wake lock keeps the screen on; do not close the lid.',
				'dropped_label'      => 'Dropped',
				'pts_label'          => 'pts',
				'elapsed_run_label'  => 'Elapsed',
				'new_run_label'      => 'New run',
				'flip_label'         => 'Flip',
				'summary_brand'      => 'BATTERY · SURF · BENCH',
			)
		);
	}
}
