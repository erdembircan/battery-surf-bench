<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView}: the sessions listing shell: the brand header above the grid's mount container.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `header` (composed markup, printed
 *       through wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-sessions">
	<?php echo wp_kses( $args['header'], AllowedHtml::tags() ); ?>

	<div id="bsb-sessions-app"></div>
</div>
