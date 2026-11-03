<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: one surfer class-preset chip.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `chip_attr` (attribute value),
 *       `chip_state` (attribute value), `chip_text` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<button type="button" class="bsb-chip" data-class="<?php echo esc_attr( $args['chip_attr'] ); ?>" data-wp-on--click="actions.selectClass" data-wp-bind--aria-pressed="<?php echo esc_attr( $args['chip_state'] ); ?>" data-wp-class--is-active="<?php echo esc_attr( $args['chip_state'] ); ?>"><?php echo esc_html( $args['chip_text'] ); ?></button>
