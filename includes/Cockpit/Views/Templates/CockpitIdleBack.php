<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: the startup postcard's back: the how-it-works guide side and the unsupported-browser warning side.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `frank_blank` (pre-escaped markup),
 *       `idle_heading` (text), `idle_subtitle` (text), `idle_step1_title`
 *       (text), `idle_step1_text` (text), `idle_step2_title` (text),
 *       `idle_step2_text` (text), `idle_step3_title` (text), `idle_step3_text`
 *       (text), `idle_notice_title` (text), `idle_notice_text` (text),
 *       `frank_warning` (pre-escaped markup), `unsupported_head` (text),
 *       `unsupported_sub` (text), `unsupported_lead` (text), `unsupported_body`
 *       (text), `unsupported_browse` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-cockpit__postcard-side bsb-cockpit__postcard-side--guide" data-wp-bind--hidden="state.isBatteryUnsupported">
			<?php echo $args['frank_blank']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

			<div class="bsb-cockpit__postcard-note">
				<h2 class="bsb-cockpit__postcard-heading"><?php echo esc_html( $args['idle_heading'] ); ?></h2>
				<p class="bsb-cockpit__postcard-subtitle"><?php echo esc_html( $args['idle_subtitle'] ); ?></p>
				<span class="bsb-cockpit__postcard-divide" aria-hidden="true"></span>
				<ol class="bsb-cockpit__postcard-steps">
					<li><span class="bsb-cockpit__postcard-num">1</span><span class="bsb-cockpit__postcard-step"><b><?php echo esc_html( $args['idle_step1_title'] ); ?></b><?php echo esc_html( $args['idle_step1_text'] ); ?></span></li>
					<li><span class="bsb-cockpit__postcard-num">2</span><span class="bsb-cockpit__postcard-step"><b><?php echo esc_html( $args['idle_step2_title'] ); ?></b><?php echo esc_html( $args['idle_step2_text'] ); ?></span></li>
					<li><span class="bsb-cockpit__postcard-num">3</span><span class="bsb-cockpit__postcard-step"><b><?php echo esc_html( $args['idle_step3_title'] ); ?></b><?php echo esc_html( $args['idle_step3_text'] ); ?></span></li>
				</ol>
				<p class="bsb-cockpit__postcard-notice"><b><?php echo esc_html( $args['idle_notice_title'] ); ?></b><?php echo esc_html( $args['idle_notice_text'] ); ?></p>
			</div>
		</div>
		<div class="bsb-cockpit__postcard-side bsb-cockpit__postcard-side--warning" hidden data-wp-bind--hidden="!state.isBatteryUnsupported">
			<?php echo $args['frank_warning']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped view markup. ?>

			<div class="bsb-cockpit__postcard-note bsb-cockpit__postcard-note--warning">
				<h2 class="bsb-cockpit__postcard-heading"><?php echo esc_html( $args['unsupported_head'] ); ?></h2>
				<p class="bsb-cockpit__postcard-subtitle"><?php echo esc_html( $args['unsupported_sub'] ); ?></p>
				<span class="bsb-cockpit__postcard-divide" aria-hidden="true"></span>
				<p class="bsb-cockpit__postcard-body"><b><?php echo esc_html( $args['unsupported_lead'] ); ?></b><?php echo esc_html( $args['unsupported_body'] ); ?></p>
				<p class="bsb-cockpit__postcard-browsers"><span class="bsb-cockpit__postcard-globe" aria-hidden="true"></span><?php echo esc_html( $args['unsupported_browse'] ); ?></p>
			</div>
		</div>
