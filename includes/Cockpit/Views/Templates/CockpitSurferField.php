<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: the surfer-profile field: the class chips, the Customize disclosure and the stat sliders.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `surfer_label` (text), `chips`
 *       (pre-escaped markup), `customize_label` (text), `points_label` (text),
 *       `reset_label` (text), `stat_rows` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<section class="bsb-field bsb-field--surfer">
					<span class="bsb-field__label"><?php echo esc_html( $args['surfer_label'] ); ?> <span class="bsb-surfer__build" data-wp-text="state.archetypeLabel"></span></span>
					<div class="bsb-chips"><?php echo $args['chips']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?></div>
					<button type="button" class="bsb-surfer__customize" data-wp-on--click="actions.toggleCustomize" data-wp-bind--aria-expanded="state.isCustomizeOpen" data-wp-class--is-open="state.isCustomizeOpen"><?php echo esc_html( $args['customize_label'] ); ?></button>
					<div class="bsb-surfer__stats" data-wp-class--is-open="state.isCustomizeOpen">
						<div class="bsb-surfer__pool" data-wp-class--is-empty="state.isBudgetEmpty">
							<span class="bsb-surfer__points" data-wp-text="state.pointsLeftDisplay"></span>
							<span class="bsb-surfer__points-label"><?php echo esc_html( $args['points_label'] ); ?></span>
							<button type="button" class="bsb-surfer__reset" data-wp-on--click="actions.resetTraits"><?php echo esc_html( $args['reset_label'] ); ?></button>
						</div>
						<?php echo $args['stat_rows']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

					</div>
				</section>
