<?php
/**
 * Tests for the benchmark sessions listing screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin\Views;

use ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView;
use ErdemBircan\BatterySurfBench\Support\View;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The view renders the listing screen's chrome. Its contract: return the
 * full-bleed coastal shell carrying the brand header (title, subtitle and the
 * cockpit link) and the grid's mount container, escaping the raw values it is
 * handed.
 */
final class SessionsScreenViewTest extends TestCase {

	/**
	 * Renders the view with representative values.
	 *
	 * @return string The rendered markup.
	 */
	private function render(): string {
		return ( new SessionsScreenView() )->render(
			array(
				'title'         => 'Sessions',
				'subtitle'      => 'Benchmark log',
				'cockpit_url'   => 'https://example.test/?bsbSession=cockpit',
				'cockpit_label' => 'Open Cockpit',
			)
		);
	}

	/**
	 * Consumers depend on the view honouring the contract.
	 */
	public function test_implements_the_view_contract(): void {
		$this->assertInstanceOf( View::class, new SessionsScreenView() );
	}

	/**
	 * The view emits the coastal shell, the brand title and subtitle, the cockpit
	 * link and the mount point.
	 */
	public function test_render_outputs_brand_header_cockpit_link_and_mount_point(): void {
		$output = $this->render();

		$this->assertStringContainsString( '<div class="bsb-sessions">', $output );
		$this->assertStringContainsString( 'Sessions', $output );
		$this->assertStringContainsString( 'Benchmark log', $output );
		$this->assertStringContainsString(
			'href="https://example.test/?bsbSession=cockpit"',
			$output
		);
		$this->assertStringContainsString( 'bsb-sessions__cockpit', $output );
		$this->assertStringContainsString( 'Open Cockpit', $output );
		$this->assertStringContainsString( 'id="bsb-sessions-app"', $output );
	}

	/**
	 * With nothing supplied the view still emits its structure rather than
	 * tripping on the missing values.
	 */
	public function test_render_tolerates_missing_data(): void {
		$output = ( new SessionsScreenView() )->render();

		$this->assertStringContainsString( '<div class="bsb-sessions">', $output );
		$this->assertStringContainsString( 'id="bsb-sessions-app"', $output );
	}

	/**
	 * The view escapes what it is handed: title and label as text, the URL
	 * through esc_url — so the consumer passes raw values, not pre-escaped ones.
	 */
	public function test_render_escapes_the_values_it_is_handed(): void {
		$output = ( new SessionsScreenView() )->render(
			array(
				'title'         => 'Sessions <script>',
				'subtitle'      => 'Log & "notes"',
				'cockpit_url'   => 'https://example.test/?a="b"',
				'cockpit_label' => 'Open & "Cockpit"',
			)
		);

		$this->assertStringContainsString( 'Sessions &lt;script&gt;', $output );
		$this->assertStringNotContainsString( '<script>', $output );
		$this->assertStringContainsString( 'Log &amp; &quot;notes&quot;', $output );
		$this->assertStringContainsString( 'Open &amp; &quot;Cockpit&quot;', $output );
		// The URL is routed through esc_url; its quotes are encoded in the href.
		$this->assertStringContainsString(
			'href="https://example.test/?a=&quot;b&quot;"',
			$output
		);
	}
}
