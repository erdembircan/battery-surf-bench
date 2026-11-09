<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SummaryCard}: the summary overlay around the flip card.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `hidden` (attribute value),
 *       `summary_card` (composed markup, printed through wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-summary"<?php echo esc_attr( $args['hidden'] ); ?> data-wp-bind--hidden="!state.isEnded" data-wp-watch="callbacks.renderSummary">
		<?php echo wp_kses( $args['summary_card'], AllowedHtml::tags() ); ?>

	</div>
