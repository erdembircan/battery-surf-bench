<?php
/**
 * Tests for the cockpit dashboard view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Cockpit\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The dashboard view renders the standalone document the cockpit is served in.
 * Its contract: emit a complete HTML document, place the given body inside it,
 * and let WordPress print the head and footer (where the Interactivity script
 * modules go).
 */
final class CockpitDashboardTest extends TestCase {

	/**
	 * Stubs the WordPress output helpers the document is built from.
	 */
	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'language_attributes' )->justReturn( null );
		Functions\when( 'bloginfo' )->justReturn( null );
		Functions\when( 'esc_html_e' )->alias(
			static function ( string $text ): void {
				echo $text; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- test stub echoing a literal.
			}
		);
	}

	/**
	 * Renders the document and captures its output.
	 *
	 * @param string $body Body markup to place in the document.
	 * @return string The rendered document.
	 */
	private function render( string $body ): string {
		Functions\when( 'wp_head' )->justReturn( null );
		Functions\when( 'wp_footer' )->justReturn( null );

		ob_start();
		( new CockpitDashboard() )->render( $body );

		return (string) ob_get_clean();
	}

	/**
	 * The view emits a full HTML document with the body placed inside it.
	 */
	public function test_render_wraps_the_body_in_a_document(): void {
		$output = $this->render( '<div class="bsb-cockpit">VIEWPORT</div>' );

		$this->assertStringContainsString( '<!DOCTYPE html>', $output );
		$this->assertStringContainsString( 'Battery Surf Bench', $output );
		$this->assertStringContainsString( '<div class="bsb-cockpit">VIEWPORT</div>', $output );
	}

	/**
	 * The view defers head and footer output to WordPress, so the Interactivity
	 * script modules and document head are printed by core.
	 */
	public function test_render_lets_wordpress_print_head_and_footer(): void {
		Functions\expect( 'wp_head' )->once();
		Functions\expect( 'wp_footer' )->once();

		ob_start();
		( new CockpitDashboard() )->render( '<div></div>' );
		ob_get_clean();

		// The Mockery expectations above are the assertions; acknowledge them so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 2 );
	}
}
