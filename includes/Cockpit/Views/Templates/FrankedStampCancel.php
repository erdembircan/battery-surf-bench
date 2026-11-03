<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\FrankedStamp}: the cancellation postmark stamped over the postage stamp.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `brand` (text), `arc` (text), `val`
 *       (text), `unit` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<span class="bsb-frank__cancel">
		<svg class="bsb-frank__pm" viewBox="-60 -60 120 120" width="100%" height="100%">
			<defs>
				<path id="bsb-frank-top" d="M-40.5 0 A40.5 40.5 0 0 1 40.5 0"></path>
				<path id="bsb-frank-bot" d="M40.5 0 A40.5 40.5 0 0 1 -40.5 0"></path>
			</defs>
			<path class="bsb-frank__bar" d="M-58 -15 q 13 -5 26 0 t 26 0"></path>
			<path class="bsb-frank__bar" d="M-58 -5 q 13 -5 26 0 t 26 0"></path>
			<path class="bsb-frank__bar" d="M-58 5 q 13 -5 26 0 t 26 0"></path>
			<path class="bsb-frank__bar" d="M-58 15 q 13 -5 26 0 t 26 0"></path>
			<circle class="bsb-frank__ring" cx="0" cy="0" r="47"></circle>
			<circle class="bsb-frank__ring" cx="0" cy="0" r="34"></circle>
			<text class="bsb-frank__arc" text-anchor="middle" dominant-baseline="central"><textPath href="#bsb-frank-top" startOffset="50%"><?php echo esc_html( $args['brand'] ); ?></textPath></text>
			<text class="bsb-frank__arc" text-anchor="middle" dominant-baseline="central"><textPath class="bsb-frank__arc-text" href="#bsb-frank-bot" startOffset="50%"><?php echo esc_html( $args['arc'] ); ?></textPath></text>
			<text class="bsb-frank__val" x="0" y="-3" text-anchor="middle" dominant-baseline="central"><?php echo esc_html( $args['val'] ); ?></text>
			<text class="bsb-frank__unit" x="0" y="11" text-anchor="middle" dominant-baseline="central"><?php echo esc_html( $args['unit'] ); ?></text>
		</svg>
	</span>
