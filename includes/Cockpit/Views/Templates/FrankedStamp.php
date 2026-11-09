<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\FrankedStamp}: the postage stamp, with the cancellation postmark over it when enabled.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `modifier` (attribute value),
 *       `cancel` (composed markup, printed through wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<span class="bsb-frank<?php echo esc_attr( $args['modifier'] ); ?>" aria-hidden="true">
	<span class="bsb-frank__stamp"></span>
	<?php echo wp_kses( $args['cancel'], AllowedHtml::tags() ); ?>

</span>
