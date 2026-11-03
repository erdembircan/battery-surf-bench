<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SummaryCard}: the summary overlay around the flip card.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `hidden` (attribute value),
 *       `summary_card` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-summary"<?php echo esc_attr( $args['hidden'] ); ?> data-wp-bind--hidden="!state.isEnded" data-wp-watch="callbacks.renderSummary">
		<?php echo $args['summary_card']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

	</div>
