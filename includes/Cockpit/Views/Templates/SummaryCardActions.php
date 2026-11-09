<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\SummaryCard}: the footer row of the summary card's back.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `footer` (pre-escaped markup).
 */

use ErdemBircan\BatterySurfBench\Support\AllowedHtml;

defined( 'ABSPATH' ) || exit;
?>
	<div class="bsb-summary__actions">
		<?php echo wp_kses( $args['footer'], AllowedHtml::tags() ); ?>

	</div>
