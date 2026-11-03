<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView}: the settings screen shell: the brand header above the app's mount container.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `header` (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-settings">
	<?php echo $args['header']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

	<div id="bsb-settings-app"></div>
</div>
