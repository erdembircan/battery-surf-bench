<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\FrankedStamp}: the postage stamp, with the cancellation postmark over it when enabled.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `modifier` (attribute value),
 *       `cancel` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<span class="bsb-frank<?php echo esc_attr( $args['modifier'] ); ?>" aria-hidden="true">
	<span class="bsb-frank__stamp"></span>
	<?php echo $args['cancel']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

</span>
