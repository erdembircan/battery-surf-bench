<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView}: the settings header's actions: the cockpit pill and the empty save slot.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `launch_pill` (pre-escaped markup).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<?php echo wp_kses( $args['launch_pill'], AllowedHtml::tags() ); ?><span class="bsb-settings__save-slot"></span>
