<?php
/**
 * Template for {@see \ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView}: the live readouts and the parallax waves (with the shark fin lane) of the readouts pill.
 *
 * @package ErdemBircan\BatterySurfBench
 *
 * @var array<string, mixed> $args Keys read: `battery_label` (text),
 *       `target_short_label` (text), `tte_label` (text), `rate10_label` (text),
 *       `rate_session_label` (text).
 */

defined( 'ABSPATH' ) || exit;
?>
<div class="bsb-deck__readouts">
				<div class="bsb-stat bsb-stat--battery" data-wp-class--is-charging="state.isCharging">
					<span class="bsb-stat__label"><?php echo esc_html( $args['battery_label'] ); ?></span>
					<span class="bsb-stat__value bsb-stat__value--lg" data-wp-style--color="state.batteryColor"><span data-wp-text="state.batteryDisplay"></span>%<span class="bsb-stat__bolt" aria-hidden="true"></span></span>
				</div>
				<div class="bsb-stat bsb-stat--target" data-wp-bind--hidden="state.isModeDuration">
					<span class="bsb-stat__label"><?php echo esc_html( $args['target_short_label'] ); ?></span>
					<span class="bsb-stat__value" data-wp-text="state.targetDisplay" data-wp-style--color="state.targetColor"></span>
				</div>
				<div class="bsb-stat">
					<span class="bsb-stat__label"><?php echo esc_html( $args['tte_label'] ); ?></span>
					<span class="bsb-stat__value" data-wp-text="state.timeToEmptyDisplay"></span>
				</div>
				<div class="bsb-stat">
					<span class="bsb-stat__label"><?php echo esc_html( $args['rate10_label'] ); ?></span>
					<span class="bsb-stat__value"><span data-wp-text="state.rate10Display"></span><span class="bsb-stat__unit">%/h</span></span>
				</div>
				<div class="bsb-stat">
					<span class="bsb-stat__label"><?php echo esc_html( $args['rate_session_label'] ); ?></span>
					<span class="bsb-stat__value"><span data-wp-text="state.rateSessionDisplay"></span><span class="bsb-stat__unit">%/h</span></span>
				</div>
			</div>

			<span class="bsb-deck__waves" aria-hidden="true" data-wp-style----bsb-wave-speed="context.speed">
				<span class="bsb-deck__wave bsb-deck__wave--back"></span>
				<span class="bsb-deck__wave bsb-deck__wave--mid"></span>
				<span class="bsb-deck__fin-lane" aria-hidden="true">
					<span class="bsb-fin" hidden data-wp-bind--hidden="!state.hasShark" data-wp-style----fin-start="state.sharkStartCss" data-wp-style----fin-end="state.sharkEndCss" data-wp-style----fin-total="state.sharkTotalCss" data-wp-style----fin-bob="state.sharkBobCss">
						<span class="bsb-fin__swimmer"><span class="bsb-fin__bob"><span class="bsb-fin__riser"><svg class="bsb-fin__body" viewBox="0 0 72 44" preserveAspectRatio="none"><defs><linearGradient id="bsb-fin-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d5f78"/><stop offset="1" stop-color="#0b2d3c"/></linearGradient></defs><path d="M60 44 C55 28 46 13 27 3 C30 15 28 30 19 44 Z" fill="url(#bsb-fin-grad)"/></svg><span class="bsb-fin__foam"></span><span class="bsb-fin__splash"></span></span></span></span>
						<span class="bsb-fin__swimmer bsb-fin__swimmer--ghost1"><span class="bsb-fin__bob"><span class="bsb-fin__riser"><span class="bsb-fin__droplet"></span></span></span></span>
						<span class="bsb-fin__swimmer bsb-fin__swimmer--ghost2"><span class="bsb-fin__bob"><span class="bsb-fin__riser"><span class="bsb-fin__droplet"></span></span></span></span>
						<span class="bsb-fin__swimmer bsb-fin__swimmer--ghost3"><span class="bsb-fin__bob"><span class="bsb-fin__riser"><span class="bsb-fin__droplet"></span></span></span></span>
						<span class="bsb-fin__swimmer bsb-fin__swimmer--ghost4"><span class="bsb-fin__bob"><span class="bsb-fin__riser"><span class="bsb-fin__droplet"></span></span></span></span>
						<span class="bsb-fin__swimmer bsb-fin__swimmer--ghost5"><span class="bsb-fin__bob"><span class="bsb-fin__riser"><span class="bsb-fin__droplet"></span></span></span></span>
					</span>
				</span>
				<span class="bsb-deck__wave bsb-deck__wave--front"></span>
			</span>
