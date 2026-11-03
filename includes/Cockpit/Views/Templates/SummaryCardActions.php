<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SummaryCard}: the footer row of the summary card's back.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `footer` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
	<div class="bsb-summary__actions">
		<?php echo $args['footer']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

	</div>
