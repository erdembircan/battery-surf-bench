<?php
/**
 * Template fixture: prints the `name` argument inside a paragraph.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys: `name`, the raw text to escape and print.
 */

defined( 'ABSPATH' ) || exit;
?>
<p class="name"><?php echo esc_html( $args['name'] ); ?></p>
