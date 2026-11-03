<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView}: the stored-session detail page's Interactivity region around the summary card.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `context` (pre-escaped markup),
 *       `summary` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-session-detail" data-wp-interactive="bsb/cockpit" <?php echo $args['context']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by wp_interactivity_data_wp_context(). ?> data-wp-init="callbacks.initDetail">
	<?php echo $args['summary']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

</div>
