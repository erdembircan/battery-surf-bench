<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Admin\Views\StartBenchmarkView}: the Start Benchmark fallback page: a title, a message and a link to the cockpit.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `title` (text), `message` (text),
 *       `cockpit_url` (URL), `cockpit_label` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="wrap">
	<h1><?php echo esc_html( $args['title'] ); ?></h1>
	<p><?php echo esc_html( $args['message'] ); ?></p>
	<a href="<?php echo esc_url( $args['cockpit_url'] ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $args['cockpit_label'] ); ?></a>
</div>
