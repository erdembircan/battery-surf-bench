<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\AdminPillView}: the admin pill rendered as a link.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `variant` (attribute value), `href`
 *       (URL), `target_attr` (pre-escaped markup), `icon_markup` (pre-escaped
 *       markup), `label` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<a class="bsb-admin-pill bsb-admin-pill--<?php echo esc_attr( $args['variant'] ); ?>" href="<?php echo esc_url( $args['href'] ); ?>"<?php echo $args['target_attr']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>><?php echo $args['icon_markup']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?><?php echo esc_html( $args['label'] ); ?></a>
