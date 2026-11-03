<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\DevTools\Views\DevToolsPanelView}: one behavior chip of the Surf group.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `chip_class` (attribute value),
 *       `key_attr` (attribute value), `key_html` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<button type="button" class="<?php echo esc_attr( $args['chip_class'] ); ?>" data-devtools-behavior="<?php echo esc_attr( $args['key_attr'] ); ?>" data-wp-on--click="actions.devtoolsSurfSteer" data-wp-bind--disabled="state.devtoolsSurfChipDisabled" data-wp-class--is-gated="state.devtoolsSurfChipGated" data-wp-class--is-running="state.devtoolsSurfChipRunning" data-wp-style----chip-dur="state.devtoolsSurfChipDurationCss"><span class="bsb-devtools__chip-tide" aria-hidden="true"></span><span class="bsb-devtools__chip-ico" aria-hidden="true"></span><span class="bsb-devtools__chip-key"><?php echo esc_html( $args['key_html'] ); ?></span></button>
