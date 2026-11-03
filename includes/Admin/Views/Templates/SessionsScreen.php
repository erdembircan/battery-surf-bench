<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView}: the sessions listing shell: the brand header above the grid's mount container.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `header` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-sessions">
	<?php echo $args['header']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

	<div id="bsb-sessions-app"></div>
</div>
