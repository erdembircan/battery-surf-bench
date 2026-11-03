<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard}: the standalone cockpit document, with its doctype, head and body around the pre-rendered cockpit.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `charset` (attribute value),
 *       `title` (text), `body` (pre-escaped markup), `devtools_panel`
 *       (pre-escaped markup).
 */

defined( 'ABSPATH' ) || exit;
?>
<!DOCTYPE html>
<html <?php echo get_language_attributes(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by get_language_attributes(). ?>>
<head>
	<meta charset="<?php echo esc_attr( $args['charset'] ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="noindex" />
	<title><?php echo esc_html( $args['title'] ); ?></title>
	<?php wp_head(); ?>

</head>
<body class="bsb-cockpit-dashboard">
	<?php echo $args['body']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

	<?php echo $args['devtools_panel']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

	<?php wp_footer(); ?>

</body>
</html>
