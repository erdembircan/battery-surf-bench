<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Course\Views\UserPageView}: a user page's title as a heading block.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `title` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading"><?php echo esc_html( $args['title'] ); ?></h1>
<!-- /wp:heading -->
