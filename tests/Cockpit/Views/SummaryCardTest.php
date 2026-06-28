<?php
/**
 * Tests for the run-summary postcard view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Cockpit\Views\SummaryCard;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The summary card's consumers are the cockpit block and the session detail
 * page. Both rely on it raising the `.bsb-summary` overlay around the shared
 * flip card, binding the frozen readouts the store paints, and placing the
 * picture front, the franked stamp and a footer it is handed. The detail page
 * additionally relies on it showing at once and carrying a "Started" stat.
 */
final class SummaryCardTest extends TestCase {

	/**
	 * Renders the card with sensible defaults, overridable per test.
	 *
	 * @param array<string, mixed> $overrides Values to override.
	 * @return string The rendered markup.
	 */
	private function card( array $overrides = array() ): string {
		return ( new SummaryCard() )->render(
			array_merge(
				array(
					'front'              => '<!--FRONT-->',
					'frank'              => '<!--FRANK-->',
					'footer'             => '<!--FOOTER-->',
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
				),
				$overrides
			)
		);
	}

	/**
	 * The card is raised by the `.bsb-summary` overlay around the shared summary
	 * flip card, with the painter watch that draws its chart and postmark.
	 */
	public function test_raises_the_summary_flip_card(): void {
		$markup = $this->card();

		$this->assertStringContainsString( 'class="bsb-summary"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--hidden="!state.isEnded"', $markup );
		$this->assertStringContainsString( 'data-wp-watch="callbacks.renderSummary"', $markup );
		$this->assertStringContainsString( 'bsb-flipcard--summary', $markup );
		$this->assertStringContainsString( 'data-wp-class--is-flipped="state.isFlipped"', $markup );
	}

	/**
	 * The picture front, the franked stamp and the footer are placed verbatim —
	 * they arrive as already-escaped child markup.
	 */
	public function test_places_the_front_stamp_and_footer_verbatim(): void {
		$markup = $this->card();

		$this->assertStringContainsString( '<!--FRONT-->', $markup );
		$this->assertStringContainsString( '<!--FRANK-->', $markup );
		$this->assertStringContainsString( '<!--FOOTER-->', $markup );
	}

	/**
	 * The report binds the frozen readouts the store paints, so the same card
	 * renders a live run's end and a stored run's detail.
	 */
	public function test_binds_the_frozen_readouts(): void {
		$markup = $this->card();

		$this->assertStringContainsString( 'data-wp-text="state.summaryHeading"', $markup );
		$this->assertStringContainsString( 'data-wp-text="state.timeToEmptyDisplay"', $markup );
		$this->assertStringContainsString( 'data-wp-text="context.summaryBatteryStart"', $markup );
		$this->assertStringContainsString( 'data-wp-bind--hidden="!context.hasGraph"', $markup );
	}

	/**
	 * The overlay ships `hidden` by default — the live cockpit raises it on run
	 * end — but a caller can have it show at once, as the detail page does so its
	 * postcard sails in on load.
	 */
	public function test_ships_hidden_by_default_and_shows_when_asked(): void {
		$this->assertStringContainsString( 'class="bsb-summary" hidden', $this->card() );
		$this->assertStringNotContainsString(
			'class="bsb-summary" hidden',
			$this->card( array( 'start_hidden' => false ) )
		);
	}
}
