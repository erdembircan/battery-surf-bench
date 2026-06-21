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
 * The view renders the listing screen's chrome. Its contract: return the wrapped
 * heading, the cockpit link, and the grid's mount container, interpolating the
 * already-escaped values it is handed.
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
				'heading'       => 'Benchmark Sessions',
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
	 * The view emits the wrapped heading, the cockpit link and the mount point.
	 */
	public function test_render_outputs_heading_cockpit_link_and_mount_point(): void {
		$output = $this->render();

		$this->assertStringContainsString( '<div class="wrap">', $output );
		$this->assertStringContainsString( 'Benchmark Sessions', $output );
		$this->assertStringContainsString(
			'<a href="https://example.test/?bsbSession=cockpit" class="page-title-action">Open Cockpit</a>',
			$output
		);
		$this->assertStringContainsString( 'id="bsb-sessions-app"', $output );
	}

	/**
	 * With nothing supplied the view still emits its structure rather than
	 * tripping on the missing values.
	 */
	public function test_render_tolerates_missing_data(): void {
		$output = ( new SessionsScreenView() )->render();

		$this->assertStringContainsString( '<div class="wrap">', $output );
		$this->assertStringContainsString( 'id="bsb-sessions-app"', $output );
	}
}
