<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\AdminPillView}: the admin pill rendered as a button.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `variant` (attribute value),
 *       `icon_markup` (pre-escaped markup), `label` (text).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<button type="button" class="bsb-admin-pill bsb-admin-pill--<?php echo esc_attr( $args['variant'] ); ?>"><?php echo wp_kses( $args['icon_markup'], AllowedHtml::tags() ); ?><?php echo esc_html( $args['label'] ); ?></button>
