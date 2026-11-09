<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView}: the stored-session detail page's Interactivity region around the summary card.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `context` (attribute value),
 *       `summary` (composed markup, printed through wp_kses).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-session-detail" data-wp-interactive="battery-surf-bench/cockpit" data-wp-context="<?php echo esc_attr( $args['context'] ); ?>" data-wp-init="callbacks.initDetail">
	<?php echo wp_kses( $args['summary'], AllowedHtml::tags() ); ?>

</div>
