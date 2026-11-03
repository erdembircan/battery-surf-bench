<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: the live status line of the readouts pill: the surfing label, the run clock and the sterile chip.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `surfing_label` (text),
 *       `elapsed_label` (text), `remaining_label` (text), `sterile_label`
 *       (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-deck__status-head">
				<span class="bsb-deck__status-mark" aria-hidden="true" data-wp-class--is-sterile="state.isSterileRun" data-wp-style----bsb-wave-speed="context.speed"></span>
				<span class="bsb-deck__status-text"><?php echo esc_html( $args['surfing_label'] ); ?> &middot; <span class="bsb-deck__clock" data-wp-text="state.runClock"></span> <span data-wp-bind--hidden="state.isModeDuration"><?php echo esc_html( $args['elapsed_label'] ); ?></span><span data-wp-bind--hidden="state.isModeTargetDrop"><?php echo esc_html( $args['remaining_label'] ); ?></span><span class="bsb-deck__sterile-chip" hidden data-wp-bind--hidden="!state.isSterileRun"><?php echo esc_html( $args['sterile_label'] ); ?></span></span>
			</div>
