<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView}: the settings header's actions: the cockpit pill and the empty save slot.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `launch_pill` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<?php echo $args['launch_pill']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?><span class="bsb-settings__save-slot"></span>
