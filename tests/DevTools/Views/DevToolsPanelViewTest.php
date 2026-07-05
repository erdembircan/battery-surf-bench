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
	 * stays live to allow Stop.
	 */
	public function test_render_wires_the_discharge_group(): void {
		$markup = ( new DevToolsPanelView() )->render();

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
	 * Every raw label handed to the view is escaped into its slot.
	 */
	public function test_render_escapes_the_supplied_labels(): void {
		$markup = ( new DevToolsPanelView() )->render(
			array(
				'dev_label'     => '<b>DEV</b>',
				'eyebrow_label' => '<script>Dev tools</script>',
				'armed_label'   => '<i>Override active</i>',
				'close_label'   => '"Close"',
				'level_label'   => '"Battery level override"',
			)
		);

		$this->assertStringNotContainsString( '<b>DEV</b>', $markup );
		$this->assertStringContainsString( '&lt;b&gt;DEV&lt;/b&gt;', $markup );
		$this->assertStringNotContainsString( '<script>Dev tools</script>', $markup );
		$this->assertStringNotContainsString( '<i>Override active</i>', $markup );
		$this->assertStringContainsString( '&lt;i&gt;Override active&lt;/i&gt;', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Close&quot;"', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Battery level override&quot;"', $markup );
	}
}
