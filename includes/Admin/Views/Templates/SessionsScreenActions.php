<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView}: the sessions header's actions: the empty live-count slot and the cockpit pill.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `cockpit_pill` (composed markup,
 *       printed through wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<span class="bsb-sessions__count"></span><?php echo wp_kses( $args['cockpit_pill'], AllowedHtml::tags() ); ?>
