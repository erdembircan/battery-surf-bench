<?php
/**
 * Tests for the stored-session detail view's rendered markup.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The detail view renders the shared summary postcard for one stored run, wrapped
 * in the `.bsb-session-detail` Interactivity region. Its consumer (the admin edit
 * screen) relies on the run's back-to-listing link riding in the card's corner
 * beside the flip badge — the same ghost pill the live cockpit's "New run" button
 * wears — rather than in an in-flow footer row.
 */
final class SessionDetailViewTest extends TestCase {

	/**
	 * Renders the detail page with sensible defaults, overridable per test.
	 *
	 * @param array<string, mixed> $overrides Values to override.
	 * @return string The rendered markup.
	 */
	private function view( array $overrides = array() ): string {
		return ( new SessionDetailView() )->render(
			array_merge(
				array(
					'context'            => 'data-wp-context=\'{}\'',
					'greeting_lead'      => 'Greetings from',
					'brand_title'        => 'Battery Surf Bench',
					'summary_brand'      => 'Battery Surf Bench',
					'flip_label'         => 'Flip',
					'tte_label'          => '100% → 0%',
					'rate_session_label' => 'Rate · session',
					'rate10_label'       => 'Rate · 10 min',
					'battery_label'      => 'Battery',
					'dropped_label'      => 'Dropped',
					'pts_label'          => 'pts',
					'elapsed_run_label'  => 'Elapsed',
					'measured_label'     => 'Measured',
					'projected_label'    => 'Projected',
					'back_label'         => 'All sessions',
					'back_url'           => '/wp-admin/edit.php?post_type=bsbench_session',
				),
				$overrides
			)
		);
	}

	/**
	 * The body is an Interactivity region on the cockpit store that arms the
	 * detail bootstrap on hydration.
	 */
	public function test_renders_the_interactivity_region(): void {
		$markup = $this->view();

		$this->assertStringContainsString( 'class="bsb-session-detail"', $markup );
		$this->assertStringContainsString( 'data-wp-interactive="battery-surf-bench/cockpit"', $markup );
		$this->assertStringContainsString( 'data-wp-init="callbacks.initDetail"', $markup );
	}

	/**
	 * The back-to-listing link wears the shared ghost pill with its own back-arrow
	 * glyph and carries the listing URL and label.
	 */
	public function test_back_link_is_a_ghost_pill_with_a_back_arrow(): void {
		$markup = $this->view();

		$this->assertStringContainsString(
			'<a class="bsb-summary__newrun bsb-summary__back" href="/wp-admin/edit.php?post_type=bsbench_session">',
			$markup
		);
		$this->assertStringContainsString( '<span class="bsb-summary__back-icon" aria-hidden="true"></span>', $markup );
		$this->assertStringContainsString( 'All sessions', $markup );
	}

	/**
	 * The link rides in the card's corner beside the flip badge (via the shared
	 * `back_actions` slot), not in an in-flow `.bsb-summary__actions` footer row —
	 * so the flip badge keeps the same breathing room it has in the cockpit.
	 */
	public function test_back_link_sits_in_the_card_corner_not_a_footer_row(): void {
		$markup = $this->view();

		$this->assertStringContainsString(
			'<div class="bsb-flipcard__corner"><a class="bsb-summary__newrun bsb-summary__back"',
			$markup
		);
		$this->assertStringNotContainsString( 'bsb-summary__actions', $markup );
	}
}
