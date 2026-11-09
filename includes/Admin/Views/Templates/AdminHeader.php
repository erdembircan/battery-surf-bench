<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\AdminHeaderView}: the admin screens' brand header: the surfer mark, the title and subtitle wordmark, and the actions slot.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `title` (text), `subtitle` (text),
 *       `actions` (composed markup, printed through wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<header class="bsb-admin-head">
	<span class="bsb-admin-head__mark" aria-hidden="true"></span>
	<span class="bsb-admin-head__wordmark">
		<h1 class="bsb-admin-head__title"><?php echo esc_html( $args['title'] ); ?></h1>
		<span class="bsb-admin-head__subtitle"><?php echo esc_html( $args['subtitle'] ); ?></span>
	</span>
	<span class="bsb-admin-head__actions"><?php echo wp_kses( $args['actions'], AllowedHtml::tags() ); ?></span>
</header>
