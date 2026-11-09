<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\AdminPillView}: the admin pill rendered as a link.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `variant` (attribute value),
 *       `href` (URL), `icon_markup` (composed markup, printed through wp_kses),
 *       `label` (text).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<a class="bsb-admin-pill bsb-admin-pill--<?php echo esc_attr( $args['variant'] ); ?>" href="<?php echo esc_url( $args['href'] ); ?>"><?php echo wp_kses( $args['icon_markup'], AllowedHtml::tags() ); ?><?php echo esc_html( $args['label'] ); ?></a>
