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
		$this->assertStringContainsString( 'data-wp-bind--data-theme="context.theme"', $markup );
		$this->assertStringContainsString( 'class="wp-block-bsb-cockpit"', $markup );
		$this->assertStringContainsString( 'data-wp-context=\'{"activeIndex":0}\'', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.next"', $markup );
		$this->assertStringContainsString( '>Next page<', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.currentLabel"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--src="state.currentSrc"', $markup );
		$this->assertStringContainsString( 'title="Surf viewport"', $markup );
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
	 * The duration field is hidden unless duration mode is active, and its
	 * stepper steps the duration and reads it back from the store.
	 */
	public function test_render_wires_the_duration_control(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-bind--hidden="state.isModeTargetDrop"', $markup );
		$this->assertStringContainsString( 'data-step="-5"', $markup );
		$this->assertStringContainsString( 'data-step="5"', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.stepDuration"', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.durationDisplay"', $markup );
	}

	/**
	 * The target-drop field is hidden in duration mode; its battery is a custom
	 * slider whose fill width and colour come from the store, driven by pointer
	 * and keyboard actions.
	 */
	public function test_render_wires_the_target_control(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'class="bsb-field bsb-field--target" data-wp-bind--hidden="state.isModeDuration"', $markup );
		$this->assertStringContainsString( 'role="slider"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--aria-valuenow="context.targetPercent"', $markup );
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
	 * The surfing indicator starts the clock ticker, reads the elapsed clock
	 * from the store, and frames it with the translated "Surfing"/"elapsed"
	 * words so they stay localizable.
	 */
	public function test_render_wires_the_surfing_indicator(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'data-wp-init---clock="callbacks.tick"', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.elapsedClock"', $markup );
		$this->assertStringContainsString( 'Surfing', $markup );
		$this->assertStringContainsString( 'elapsed', $markup );
	}

	/**
	 * The theme toggle calls `actions.toggleTheme` and carries its accessible
	 * label so the deck can switch between the light and dark themes.
	 */
	public function test_render_wires_the_theme_toggle(): void {
		$markup = $this->render();

		$this->assertStringContainsString( 'class="bsb-deck__theme"', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.toggleTheme"', $markup );
		$this->assertStringContainsString( 'aria-label="Toggle light or dark theme"', $markup );
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
				'tte_label'          => 'Time to empty',
				'surfing_label'      => 'Surfing',
				'elapsed_label'      => 'elapsed',
				'start_label'        => 'Start',
				'stop_label'         => 'Stop',
				'plugged_label'      => 'Plugged in',
				'next_label'         => 'Next page',
				'viewport_title'     => 'Surf viewport',
			)
		);
	}
}
