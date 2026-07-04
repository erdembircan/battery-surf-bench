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
 * cockpit context here), and every raw label the manager hands it escaped into
 * its slot.
 */
final class DevToolsPanelViewTest extends TestCase {

	/**
	 * The manager relies on every view honouring the shared contract.
	 */
	public function test_is_a_view(): void {
		$this->assertInstanceOf( View::class, new DevToolsPanelView() );
	}

	/**
	 * The panel is its own Interactivity region on the `bsb/cockpit` namespace,
	 * bound only to `devtools`-prefixed state and actions.
	 */
	public function test_render_wires_the_interactive_region(): void {
		$markup = ( new DevToolsPanelView() )->render();

		$this->assertStringContainsString( 'data-wp-interactive="bsb/cockpit"', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsToggleOpen"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--hidden="!state.devtools.open"', $markup );
		$this->assertStringContainsString(
			'data-wp-on--change="actions.devtoolsToggleBatteryEnabled"',
			$markup
		);
		$this->assertStringContainsString(
			'data-wp-bind--checked="state.devtools.battery.enabled"',
			$markup
		);
		$this->assertStringContainsString( 'data-wp-on--click="actions.devtoolsSetCharging"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="system"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="charging"', $markup );
		$this->assertStringContainsString( 'data-devtools-charging="discharging"', $markup );
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
				'dev_label'      => '<b>DEV</b>',
				'title_label'    => '<script>Dev Tools</script>',
				'collapse_label' => '"Collapse"',
			)
		);

		$this->assertStringNotContainsString( '<b>DEV</b>', $markup );
		$this->assertStringContainsString( '&lt;b&gt;DEV&lt;/b&gt;', $markup );
		$this->assertStringNotContainsString( '<script>Dev Tools</script>', $markup );
		$this->assertStringContainsString( 'aria-label="&quot;Collapse&quot;"', $markup );
	}
}
