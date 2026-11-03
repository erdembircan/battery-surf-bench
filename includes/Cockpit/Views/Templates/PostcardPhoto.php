<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\PostcardPhoto}: the postcard's picture face: the surfer mark, the sunset wash and the greeting.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `modifier` (attribute value),
 *       `greeting_lead` (text), `brand_title` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-photo<?php echo esc_attr( $args['modifier'] ); ?>">
	<span class="bsb-photo__mark" aria-hidden="true"></span>
	<span class="bsb-photo__wash" aria-hidden="true"></span>
	<span class="bsb-photo__grain" aria-hidden="true"></span>
	<p class="bsb-photo__greet"><?php echo esc_html( $args['greeting_lead'] ); ?><span><?php echo esc_html( $args['brand_title'] ); ?></span></p>
</div>
