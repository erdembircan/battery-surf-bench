<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\FlipPostcard}: the two-faced flip postcard with a flip badge on each face.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `modifier` (attribute value),
 *       `flip_state` (attribute value), `front` (pre-escaped markup),
 *       `flip_action` (attribute value), `flip_label` (text), `back`
 *       (pre-escaped markup), `back_actions` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-flipcard<?php echo esc_attr( $args['modifier'] ); ?>" data-wp-class--is-flipped="<?php echo esc_attr( $args['flip_state'] ); ?>">
	<div class="bsb-flipcard__inner">
		<div class="bsb-flipcard__face bsb-flipcard__face--front">
			<?php echo $args['front']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

			<div class="bsb-flipcard__corner"><button type="button" class="bsb-flipcard__flip" data-wp-on--click="<?php echo esc_attr( $args['flip_action'] ); ?>"><span class="bsb-flipcard__flip-icon" aria-hidden="true"></span><?php echo esc_html( $args['flip_label'] ); ?></button></div>
		</div>
		<div class="bsb-flipcard__face bsb-flipcard__face--back">
			<?php echo $args['back']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

			<div class="bsb-flipcard__corner"><?php echo $args['back_actions']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?><button type="button" class="bsb-flipcard__flip bsb-flipcard__flip--paper" data-wp-on--click="<?php echo esc_attr( $args['flip_action'] ); ?>"><span class="bsb-flipcard__flip-icon" aria-hidden="true"></span><?php echo esc_html( $args['flip_label'] ); ?></button></div>
		</div>
	</div>
</div>
