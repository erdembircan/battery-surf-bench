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
	 * the interactive region, and the controls and viewport carry the store
	 * directives the client view (view.ts) hydrates against.
	 */
	public function test_render_wires_the_interactive_region(): void {
		$markup = ( new CockpitView() )->render(
			array(
				'wrapper'        => 'class="wp-block-bsb-cockpit"',
				'context'        => 'data-wp-context=\'{"activeIndex":0}\'',
				'next_label'     => 'Next page',
				'viewport_title' => 'Surf viewport',
			)
		);

		$this->assertStringContainsString( 'data-wp-interactive="bsb/cockpit"', $markup );
		$this->assertStringContainsString( 'class="wp-block-bsb-cockpit"', $markup );
		$this->assertStringContainsString( 'data-wp-context=\'{"activeIndex":0}\'', $markup );
		$this->assertStringContainsString( 'data-wp-on--click="actions.next"', $markup );
		$this->assertStringContainsString( '>Next page<', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.currentLabel"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--src="state.currentSrc"', $markup );
		$this->assertStringContainsString( 'title="Surf viewport"', $markup );
	}
}
