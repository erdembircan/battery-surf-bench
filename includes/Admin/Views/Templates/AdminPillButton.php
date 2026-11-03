<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\AdminPillView}: the admin pill rendered as a button.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `variant` (attribute value),
 *       `icon_markup` (pre-escaped markup), `label` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<button type="button" class="bsb-admin-pill bsb-admin-pill--<?php echo esc_attr( $args['variant'] ); ?>"><?php echo $args['icon_markup']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?><?php echo esc_html( $args['label'] ); ?></button>
