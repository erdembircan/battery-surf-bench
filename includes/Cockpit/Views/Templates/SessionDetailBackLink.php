<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView}: the detail card's back-to-listing link.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `back_url` (URL), `back_label`
 *       (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<a class="bsb-summary__newrun bsb-summary__back" href="<?php echo esc_url( $args['back_url'] ); ?>"><span class="bsb-summary__back-icon" aria-hidden="true"></span><?php echo esc_html( $args['back_label'] ); ?></a>
