<?php
/**
 * Tests for the cockpit dashboard view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit\Views;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The dashboard view renders the standalone document the cockpit is served in.
 * Its contract: return a complete HTML document, place the given body inside it,
 * and capture WordPress's head and footer output into it (where the
 * Interactivity script modules go).
 */
final class CockpitDashboardTest extends TestCase {

	/**
	 * Stubs the WordPress output helpers the document is built from.
	 */
	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'get_language_attributes' )->justReturn( 'lang="en-US"' );
		Functions\when( 'get_bloginfo' )->justReturn( 'UTF-8' );
		Functions\when( 'esc_attr' )->returnArg();
	}

	/**
	 * Renders the document.
	 *
	 * @param string $body Body markup to place in the document.
	 * @return string The rendered document.
	 */
	private function render( string $body ): string {
		Functions\when( 'wp_head' )->justReturn( null );
		Functions\when( 'wp_footer' )->justReturn( null );

		return ( new CockpitDashboard() )->render( array( 'body' => $body ) );
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
	 * The view captures `wp_head()`/`wp_footer()` into the document, so the
	 * Interactivity script modules and document head core prints land inside it.
	 */
	public function test_render_includes_wordpress_head_and_footer_output(): void {
		Functions\when( 'wp_head' )->alias(
			static function (): void {
				echo '<!-- HEAD -->';
			}
		);
		Functions\when( 'wp_footer' )->alias(
			static function (): void {
				echo '<!-- FOOTER -->';
			}
		);

		$output = ( new CockpitDashboard() )->render( array( 'body' => '<div></div>' ) );

		$this->assertStringContainsString( '<!-- HEAD -->', $output );
		$this->assertStringContainsString( '<!-- FOOTER -->', $output );
	}

	/**
	 * With no body supplied the view still emits a valid document rather than
	 * tripping on the missing value.
	 */
	public function test_render_tolerates_a_missing_body(): void {
		Functions\when( 'wp_head' )->justReturn( null );
		Functions\when( 'wp_footer' )->justReturn( null );

		$output = ( new CockpitDashboard() )->render();

		$this->assertStringContainsString( '<!DOCTYPE html>', $output );
	}
}
