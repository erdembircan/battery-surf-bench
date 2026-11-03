<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\AdminPillView}: the pill's decorative icon span.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `icon` (attribute value).
 */

defined( 'ABSPATH' ) || exit;
?>
<span class="bsb-admin-pill__icon bsb-admin-pill__icon--<?php echo esc_attr( $args['icon'] ); ?>" aria-hidden="true"></span>
