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

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php echo esc_attr( $args['charset'] ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="noindex" />
	<title><?php echo esc_html( $args['title'] ); ?></title>
	<?php wp_head(); ?>

</head>
<body class="bsb-cockpit-dashboard">
	<?php echo wp_kses( $args['body'], AllowedHtml::tags() ); ?>

	<?php echo wp_kses( $args['devtools_panel'], AllowedHtml::tags() ); ?>

	<?php wp_footer(); ?>

</body>
</html>
