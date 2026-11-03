<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView}: the sessions header's actions: the empty live-count slot and the cockpit pill.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `cockpit_pill` (pre-escaped
 *       markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<span class="bsb-sessions__count"></span><?php echo $args['cockpit_pill']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>
