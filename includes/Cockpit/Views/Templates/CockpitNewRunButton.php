<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: the run-summary card's "New run" button.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `new_run_label` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<button type="button" class="bsb-summary__newrun" data-wp-on--click="actions.newRun"><span class="bsb-summary__newrun-icon" aria-hidden="true"></span><?php echo esc_html( $args['new_run_label'] ); ?></button>
