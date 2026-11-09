<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SummaryCard}: the back of the summary card: the franked stamp and the run report.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `frank` (composed markup, printed
 *       through wp_kses), `measured_label` (text), `projected_label` (text),
 *       `tte_label` (text), `rate_session_label` (text), `rate10_label` (text),
 *       `battery_label` (text), `dropped_label` (text), `pts_label` (text),
 *       `elapsed_run_label` (text), `actions` (composed markup, printed through
 *       wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<?php echo wp_kses( $args['frank'], AllowedHtml::tags() ); ?>

		<div class="bsb-summary__report">
			<h2 class="bsb-summary__head" data-wp-text="state.summaryHeading"></h2>
			<p class="bsb-summary__sig" data-wp-text="state.summarySig"></p>
			<span class="bsb-summary__divide" aria-hidden="true"></span>
			<div class="bsb-summary__graph" data-wp-bind--hidden="!context.hasGraph">
				<svg class="bsb-summary__chart" viewBox="0 0 480 90" direction="ltr" aria-hidden="true"></svg>
				<div class="bsb-summary__legend" aria-hidden="true">
					<span class="bsb-summary__legend-item"><span class="bsb-summary__legend-swatch"></span><?php echo esc_html( $args['measured_label'] ); ?></span>
					<span class="bsb-summary__legend-item"><span class="bsb-summary__legend-swatch bsb-summary__legend-swatch--fit"></span><?php echo esc_html( $args['projected_label'] ); ?></span>
				</div>
			</div>
			<div class="bsb-summary__stats">
				<div class="bsb-stat"><span class="bsb-stat__label"><?php echo esc_html( $args['tte_label'] ); ?></span><span class="bsb-stat__value" data-wp-text="state.timeToEmptyDisplay"></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label"><?php echo esc_html( $args['rate_session_label'] ); ?></span><span class="bsb-stat__value"><span data-wp-text="state.rateSessionDisplay"></span><span class="bsb-stat__unit">%/h</span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label"><?php echo esc_html( $args['rate10_label'] ); ?></span><span class="bsb-stat__value"><span data-wp-text="state.rate10Display"></span><span class="bsb-stat__unit">%/h</span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label"><?php echo esc_html( $args['battery_label'] ); ?></span><span class="bsb-stat__value bsb-stat__value--arrow"><span data-wp-text="context.summaryBatteryStart"></span><span class="bsb-stat__arrow" aria-hidden="true"></span><span data-wp-text="context.summaryBatteryEnd"></span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label"><?php echo esc_html( $args['dropped_label'] ); ?></span><span class="bsb-stat__value"><span data-wp-text="context.summaryDropped"></span><span class="bsb-stat__unit"><?php echo esc_html( $args['pts_label'] ); ?></span></span></div>
				<div class="bsb-stat"><span class="bsb-stat__label"><?php echo esc_html( $args['elapsed_run_label'] ); ?></span><span class="bsb-stat__value" data-wp-text="state.summaryElapsed"></span></div>
			</div>
			<?php echo wp_kses( $args['actions'], AllowedHtml::tags() ); ?>

		</div>
