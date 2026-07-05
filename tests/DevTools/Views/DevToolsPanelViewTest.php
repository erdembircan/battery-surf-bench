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
	 * appears, only from the derived `devtoolsIsArmed` getter — never from the
	 * sub-tool's plain `enabled` flag, which alone overrides nothing.
	 */
	public function test_render_wires_the_armed_indicators_to_the_derived_getter(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringContainsString( 'data-wp-class--is-armed="state.devtoolsIsArmed"', $markup );
		$this->assertStringContainsString(
			'data-wp-bind--hidden="!state.devtoolsIsArmed"',
			$markup
		);
		// Never bound to plain `enabled` — that was the pre-review bug.
		$this->assertStringNotContainsString(
			'data-wp-class--is-armed="state.devtools.battery.enabled"',
			$markup
		);
	}

	/**
	 * The battery group's body mutes when the sub-tool is disabled, the
	 * charging tri-state and level controls are wired, and the slider drives
	 * both its readout text and its `--fill` track custom property.
	 */
	public function test_render_wires_the_battery_group(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringContainsString(
			'data-wp-on--change="actions.devtoolsToggleBatteryEnabled"',
			$markup
		);
		$this->assertStringContainsString(
			'data-wp-bind--checked="state.devtools.battery.enabled"',
			$markup
		);
		$this->assertStringContainsString(
			'data-wp-class--is-muted="!state.devtools.battery.enabled"',
			$markup
		);
		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsSetCharging"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="system"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="charging"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="discharging"', $markup );
		$this->assertStringContainsString(
			'data-wp-bind--checked="state.devtoolsIsLevelForced"',
			$markup
		);
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
	 * Every raw label handed to the view is escaped into its slot.
	 */
	public function test_render_escapes_the_supplied_labels(): void {
		$markup = ( new DevToolsPanelView() )->render(
			array(
				'dev_label'            => '<b>DEV</b>',
				'eyebrow_label'        => '<script>Dev tools</script>',
				'armed_label'          => '<i>Override active</i>',
				'close_label'          => '"Close"',
				'battery_enable_label' => '"Enable"',
			)
		);

		$this->assertStringNotContainsString( '<b>DEV</b>', $markup );
		$this->assertStringContainsString( '&lt;b&gt;DEV&lt;/b&gt;', $markup );
		$this->assertStringNotContainsString( '<script>Dev tools</script>', $markup );
		$this->assertStringNotContainsString( '<i>Override active</i>', $markup );
		$this->assertStringContainsString( '&lt;i&gt;Override active&lt;/i&gt;', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Close&quot;"', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Enable&quot;"', $markup );
	}
}
