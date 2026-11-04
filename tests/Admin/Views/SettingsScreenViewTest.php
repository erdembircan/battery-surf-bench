<?php
/**
 * Tests for the settings screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin\Views;

use ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The view renders the settings screen's chrome. Its contract: return the
 * full-bleed coastal shell carrying the brand header (title, subtitle, the
 * cockpit link and the app's save slot) and the app's mount container,
 * escaping the raw values it is handed.
 */
final class SettingsScreenViewTest extends TestCase {

	/**
	 * Renders the view with representative values.
	 *
	 * @return string The rendered markup.
	 */
	private function render(): string {
		return ( new SettingsScreenView() )->render(
			array(
				'title'         => 'Battery Surf Bench',
				'subtitle'      => 'Settings',
				'cockpit_url'   => 'https://example.test/?bsbenchSession=cockpit',
				'cockpit_label' => 'New Benchmark',
			)
		);
	}

	/**
	 * Consumers depend on the view honouring the contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new SettingsScreenView() );
	}

	/**
	 * The view emits the coastal shell, the brand title and subtitle, the
	 * cockpit link, the save slot, and the app's mount point.
	 */
	public function test_render_outputs_brand_header_cockpit_link_save_slot_and_mount_point(): void {
		$output = $this->render();

		$this->assertStringContainsString( '<div class="bsb-settings">', $output );
		$this->assertStringContainsString( 'Battery Surf Bench', $output );
		$this->assertStringContainsString( 'Settings', $output );
		$this->assertStringContainsString(
			'href="https://example.test/?bsbenchSession=cockpit"',
			$output
		);
		// The cockpit link is the shared outline admin pill (AdminPillView).
		$this->assertStringContainsString( 'bsb-admin-pill--outline', $output );
		$this->assertStringContainsString( 'New Benchmark', $output );
		// Opens the cockpit in a new tab, away from the settings screen.
		$this->assertStringContainsString( 'target="_blank"', $output );
		$this->assertStringContainsString( 'rel="noopener noreferrer"', $output );
		// The app portals its own Save button into this empty slot.
		$this->assertStringContainsString( 'bsb-settings__save-slot', $output );
		$this->assertStringContainsString( 'id="bsb-settings-app"', $output );
	}

	/**
	 * With nothing supplied the view still emits its structure rather than
	 * tripping on the missing values.
	 */
	public function test_render_tolerates_missing_data(): void {
		$output = ( new SettingsScreenView() )->render();

		$this->assertStringContainsString( '<div class="bsb-settings">', $output );
		$this->assertStringContainsString( 'id="bsb-settings-app"', $output );
	}

	/**
	 * The view escapes what it is handed: title and label as text, the URL
	 * through esc_url — so the consumer passes raw values, not pre-escaped ones.
	 */
	public function test_render_escapes_the_values_it_is_handed(): void {
		$output = ( new SettingsScreenView() )->render(
			array(
				'title'         => 'Settings <script>',
				'subtitle'      => 'Config & "notes"',
				'cockpit_url'   => 'https://example.test/?a="b"',
				'cockpit_label' => 'New & "Benchmark"',
			)
		);

		$this->assertStringContainsString( 'Settings &lt;script&gt;', $output );
		$this->assertStringNotContainsString( '<script>', $output );
		$this->assertStringContainsString( 'Config &amp; &quot;notes&quot;', $output );
		$this->assertStringContainsString( 'New &amp; &quot;Benchmark&quot;', $output );
		// The URL is routed through esc_url; its quotes are encoded in the href.
		$this->assertStringContainsString(
			'href="https://example.test/?a=&quot;b&quot;"',
			$output
		);
	}
}
