<?php
/**
 * Run-summary postcard — the end-of-run report card.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * The run-summary flip postcard: the franked (cancelled) stamp and the run
 * report on its written back, wrapped in the `.bsb-summary` overlay that raises
 * it. Built as one shared view so the live cockpit and the stored-session detail
 * page show an identical card — only the wiring around it differs.
 *
 * Both consumers seed the same store fields and bind the same getters; this view
 * varies only in three places the caller controls: whether the overlay ships
 * `hidden` (the cockpit raises it on run end, the detail page shows it at once),
 * an optional "Started" stat the detail page adds (the live summary has no
 * wall-clock start to show), and the footer slot (the cockpit's "New run" button
 * versus the detail page's "back to listing" link). The picture front, the
 * franked stamp and the footer arrive as already-escaped markup and are placed
 * verbatim; this view escapes only its own text slots.
 */
class SummaryCard implements View {

	/**
	 * Renders the run-summary postcard inside its raising overlay.
	 *
	 * @param array<string, mixed> $data {
	 *     View data.
	 *
	 *     @type string $front              Already-escaped markup for the picture front face.
	 *     @type string $frank              Already-escaped franked-stamp markup for the back.
	 *     @type string $footer             Already-escaped footer markup (e.g. the "New run" button).
	 *     @type string $flip_label         Raw label for the flip badge (the view escapes it).
	 *     @type string $tte_label          Raw label for the time-to-empty stat.
	 *     @type string $rate_session_label Raw label for the session drain-rate stat.
	 *     @type string $rate10_label       Raw label for the 10-minute drain-rate stat.
	 *     @type string $battery_label      Raw label for the battery start→end stat.
	 *     @type string $dropped_label      Raw label for the dropped-points stat.
	 *     @type string $pts_label          Raw unit label for the dropped-points stat.
	 *     @type string $elapsed_run_label  Raw label for the elapsed-run stat.
	 *     @type string $measured_label     Raw legend label for the measured drain series.
	 *     @type string $projected_label    Raw legend label for the 100→0 projection.
	 *     @type bool   $start_hidden       Whether the overlay ships `hidden` (raised later by the store).
	 * }
	 * @return string The `.bsb-summary` overlay markup with the summary card inside.
	 */
	public function render( array $data = array() ): string {
		$front              = isset( $data['front'] ) ? (string) $data['front'] : '';
		$frank              = isset( $data['frank'] ) ? (string) $data['frank'] : '';
		$footer             = isset( $data['footer'] ) ? (string) $data['footer'] : '';
		$flip_label         = isset( $data['flip_label'] ) ? (string) $data['flip_label'] : '';
		$tte_label          = esc_html( isset( $data['tte_label'] ) ? (string) $data['tte_label'] : '' );
		$rate_session_label = esc_html( isset( $data['rate_session_label'] ) ? (string) $data['rate_session_label'] : '' );
		$rate10_label       = esc_html( isset( $data['rate10_label'] ) ? (string) $data['rate10_label'] : '' );
		$battery_label      = esc_html( isset( $data['battery_label'] ) ? (string) $data['battery_label'] : '' );
		$dropped_label      = esc_html( isset( $data['dropped_label'] ) ? (string) $data['dropped_label'] : '' );
		$pts_label          = esc_html( isset( $data['pts_label'] ) ? (string) $data['pts_label'] : '' );
		$elapsed_run_label  = esc_html( isset( $data['elapsed_run_label'] ) ? (string) $data['elapsed_run_label'] : '' );
		$measured_label     = esc_html( isset( $data['measured_label'] ) ? (string) $data['measured_label'] : '' );
		$projected_label    = esc_html( isset( $data['projected_label'] ) ? (string) $data['projected_label'] : '' );
		$start_hidden       = ! isset( $data['start_hidden'] ) || (bool) $data['start_hidden'];

		$summary_back = <<<HTML
{$frank}
		<div class="bsb-summary__report">
			<h2 class="bsb-summary__head" data-wp-text="state.summaryHeading"></h2>
			<p class="bsb-summary__sig" data-wp-text="state.summarySig"></p>
			<span class="bsb-summary__divide" aria-hidden="true"></span>
			<div class="bsb-summary__graph" data-wp-bind--hidden="!context.hasGraph">
				<svg class="bsb-summary__chart" viewBox="0 0 480 90" aria-hidden="true"></svg>
				<div class="bsb-summary__legend" aria-hidden="true">
					<span class="bsb-summary__legend-item"><span class="bsb-summary__legend-swatch"></span>{$measured_label}</span>
					<span class="bsb-summary__legend-item"><span class="bsb-summary__legend-swatch bsb-summary__legend-swatch--fit"></span>{$projected_label}</span>
				</div>
			</div>
			<div class="bsb-summary__stats">
				<div class="bsb-stat"><span class="bsb-stat__label">{$tte_label}</span><span class="bsb-stat__value" data-wp-text="state.timeToEmptyDisplay"></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label">{$rate_session_label}</span><span class="bsb-stat__value"><span data-wp-text="state.rateSessionDisplay"></span><span class="bsb-stat__unit">%/h</span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label">{$rate10_label}</span><span class="bsb-stat__value"><span data-wp-text="state.rate10Display"></span><span class="bsb-stat__unit">%/h</span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label">{$battery_label}</span><span class="bsb-stat__value bsb-stat__value--arrow"><span data-wp-text="context.summaryBatteryStart"></span><span class="bsb-stat__arrow" aria-hidden="true"></span><span data-wp-text="context.summaryBatteryEnd"></span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label">{$dropped_label}</span><span class="bsb-stat__value"><span data-wp-text="context.summaryDropped"></span><span class="bsb-stat__unit">{$pts_label}</span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label">{$elapsed_run_label}</span><span class="bsb-stat__value" data-wp-text="state.summaryElapsed"></span></div>
			</div>
			<div class="bsb-summary__actions">
				{$footer}
			</div>
		</div>
HTML;

		$summary_card = ( new FlipPostcard() )->render(
			array(
				'front'       => $front,
				'back'        => $summary_back,
				'flip_label'  => $flip_label,
				'flip_action' => 'actions.toggleFlip',
				'flip_state'  => 'state.isFlipped',
				'modifier'    => 'bsb-flipcard--summary',
			)
		);

		$hidden = $start_hidden ? ' hidden' : '';

		return <<<HTML
<div class="bsb-summary"{$hidden} data-wp-bind--hidden="!state.isEnded" data-wp-watch="callbacks.renderSummary">
		{$summary_card}
	</div>
HTML;
	}
}
