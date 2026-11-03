<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: one surfer stat row: its name, value readout, lever caption and slider.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `stat_name` (text), `stat_i`
 *       (integer), `stat_lever` (text), `stat_aria` (attribute value).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-stat">
						<div class="bsb-stat__top"><span class="bsb-stat__name"><?php echo esc_html( $args['stat_name'] ); ?></span><span class="bsb-stat__val" data-wp-text="state.traitValue<?php echo (int) $args['stat_i']; ?>"></span></div>
						<span class="bsb-stat__lever"><?php echo esc_html( $args['stat_lever'] ); ?></span>
						<input class="bsb-stat__slider" type="range" min="0" max="10" step="1" data-index="<?php echo (int) $args['stat_i']; ?>" aria-label="<?php echo esc_attr( $args['stat_aria'] ); ?>" data-wp-bind--value="state.traitValue<?php echo (int) $args['stat_i']; ?>" data-wp-style--background="state.traitTrack<?php echo (int) $args['stat_i']; ?>" data-wp-on--input="actions.setTrait" />
					</div>
