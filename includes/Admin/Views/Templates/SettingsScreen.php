<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView}: the settings screen shell: the brand header above the app's mount container.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `header` (pre-escaped markup).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-settings">
	<?php echo wp_kses( $args['header'], AllowedHtml::tags() ); ?>

	<div id="bsb-settings-app"></div>
</div>
