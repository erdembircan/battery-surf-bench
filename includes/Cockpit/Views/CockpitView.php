<?php
/**
 * Cockpit block view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the `bsb/cockpit` block's front-end markup: the Interactivity-driven
 * region split into a control deck and a surf stage. The deck carries the run
 * controls — mode, duration, baseline calibration, speed and a start/stop
 * control — each wired to the client store ({@see src/cockpit/view.ts}). While a
 * run is live the configuration controls give way to the live readouts pill; the
 * stage carries the viewport iframe. The block's server render
 * template ({@see src/cockpit/render.php}) prepares the dynamic, already-escaped
 * values — wrapper attributes, the per-instance `data-wp-context`, and the
 * translated labels — and hands them here; this view owns the structure, held
 * in a heredoc, so no HTML is written inline in the render template.
 */
class CockpitView implements View {

	/**
	 * Renders the cockpit block markup.
	 *
	 * @param array<string, mixed> $data {
	 *     Already-escaped values from the block render template.
	 *
	 *     @type string $wrapper           Block wrapper attributes from `get_block_wrapper_attributes()`.
	 *     @type string $context           `data-wp-context` attribute from `wp_interactivity_data_wp_context()`.
	 *     @type string $brand_title       Translated, escaped plugin name shown in the deck brand.
	 *     @type string $brand_subtitle    Translated, escaped "Cockpit" label under the brand.
	 *     @type string $theme_label       Translated, escaped accessible label for the theme toggle.
	 *     @type string $mode_label        Translated, escaped label for the mode field.
	 *     @type string $duration_mode     Translated, escaped label for the duration mode option.
	 *     @type string $target_drop_mode  Translated, escaped label for the target-drop mode option.
	 *     @type string $duration_label    Translated, escaped label for the duration field.
	 *     @type string $minutes_label     Translated, escaped unit label for the duration readout.
	 *     @type string $decrease_label    Translated, escaped accessible label for the decrease control.
	 *     @type string $increase_label    Translated, escaped accessible label for the increase control.
	 *     @type string $target_label      Translated, escaped label for the target-drop field.
	 *     @type string $target_aria       Translated, escaped accessible label for the target slider.
	 *     @type string $baseline_label    Translated, escaped label for the baseline calibration toggle.
	 *     @type string $speed_label        Translated, escaped label for the speed field.
	 *     @type string $battery_label      Translated, escaped label for the battery readout.
	 *     @type string $rate10_label       Translated, escaped label for the 10-minute drain rate.
	 *     @type string $rate_session_label Translated, escaped label for the session drain rate.
	 *     @type string $tte_label          Translated, escaped label for the time-to-empty readout.
	 *     @type string $surfing_label     Translated, escaped "Surfing" word for the running indicator.
	 *     @type string $elapsed_label     Translated, escaped "elapsed" word for the running indicator.
	 *     @type string $start_label       Translated, escaped label for the run control when idle.
	 *     @type string $stop_label        Translated, escaped label for the run control when running.
	 *     @type string $plugged_label     Translated, escaped run-control label when blocked by charging.
	 *     @type string $viewport_title    Translated, escaped title for the viewport iframe.
	 * }
	 * @return string The block's HTML.
	 */
	public function render( array $data = array() ): string {
		$wrapper            = isset( $data['wrapper'] ) ? (string) $data['wrapper'] : '';
		$context            = isset( $data['context'] ) ? (string) $data['context'] : '';
		$brand_title        = isset( $data['brand_title'] ) ? (string) $data['brand_title'] : '';
		$brand_subtitle     = isset( $data['brand_subtitle'] ) ? (string) $data['brand_subtitle'] : '';
		$theme_label        = isset( $data['theme_label'] ) ? (string) $data['theme_label'] : '';
		$mode_label         = isset( $data['mode_label'] ) ? (string) $data['mode_label'] : '';
		$duration_mode      = isset( $data['duration_mode'] ) ? (string) $data['duration_mode'] : '';
		$target_drop_mode   = isset( $data['target_drop_mode'] ) ? (string) $data['target_drop_mode'] : '';
		$duration_label     = isset( $data['duration_label'] ) ? (string) $data['duration_label'] : '';
		$minutes_label      = isset( $data['minutes_label'] ) ? (string) $data['minutes_label'] : '';
		$decrease_label     = isset( $data['decrease_label'] ) ? (string) $data['decrease_label'] : '';
		$increase_label     = isset( $data['increase_label'] ) ? (string) $data['increase_label'] : '';
		$target_label       = isset( $data['target_label'] ) ? (string) $data['target_label'] : '';
		$target_aria        = isset( $data['target_aria'] ) ? (string) $data['target_aria'] : '';
		$baseline_label     = isset( $data['baseline_label'] ) ? (string) $data['baseline_label'] : '';
		$speed_label        = isset( $data['speed_label'] ) ? (string) $data['speed_label'] : '';
		$battery_label      = isset( $data['battery_label'] ) ? (string) $data['battery_label'] : '';
		$rate10_label       = isset( $data['rate10_label'] ) ? (string) $data['rate10_label'] : '';
		$rate_session_label = isset( $data['rate_session_label'] ) ? (string) $data['rate_session_label'] : '';
		$tte_label          = isset( $data['tte_label'] ) ? (string) $data['tte_label'] : '';
		$surfing_label      = isset( $data['surfing_label'] ) ? (string) $data['surfing_label'] : '';
		$elapsed_label      = isset( $data['elapsed_label'] ) ? (string) $data['elapsed_label'] : '';
		$start_label        = isset( $data['start_label'] ) ? (string) $data['start_label'] : '';
		$stop_label         = isset( $data['stop_label'] ) ? (string) $data['stop_label'] : '';
		$plugged_label      = isset( $data['plugged_label'] ) ? (string) $data['plugged_label'] : '';
		$viewport_title     = isset( $data['viewport_title'] ) ? (string) $data['viewport_title'] : '';

		// Each duration-odometer wheel is a strip of 0–9 repeated three times; the
		// client store (rollDuration) slides it to roll the digit. Built here so
		// the wheel markup stays a single repeated unit owned by the view.
		$bsb_digit_cells = <<<'CELLS'
<span class="bsb-odometer__cell">0</span><span class="bsb-odometer__cell">1</span><span class="bsb-odometer__cell">2</span><span class="bsb-odometer__cell">3</span><span class="bsb-odometer__cell">4</span><span class="bsb-odometer__cell">5</span><span class="bsb-odometer__cell">6</span><span class="bsb-odometer__cell">7</span><span class="bsb-odometer__cell">8</span><span class="bsb-odometer__cell">9</span>
CELLS;
		$odometer_cells  = str_repeat( $bsb_digit_cells, 3 );

		return <<<HTML
<div {$wrapper} data-wp-interactive="bsb/cockpit" {$context} data-wp-init="callbacks.initTheme" data-wp-init---battery="callbacks.initBattery" data-wp-bind--data-theme="context.theme">
	<aside class="bsb-cockpit__deck">
		<header class="bsb-deck__brand">
			<span class="bsb-deck__wordmark">
				<span class="bsb-deck__title">{$brand_title}</span>
				<span class="bsb-deck__subtitle">{$brand_subtitle}</span>
			</span>
			<button type="button" class="bsb-deck__theme" data-pref="system" data-wp-bind--data-pref="context.themePref" data-wp-on--click="actions.toggleTheme" aria-label="{$theme_label}"></button>
		</header>

		<div class="bsb-deck__body">
			<div class="bsb-deck__swap" data-wp-class--is-running="state.isRunning">
			<div class="bsb-deck__config">
			<section class="bsb-field">
				<span class="bsb-field__label">{$mode_label}</span>
				<div class="bsb-seg" role="group" aria-label="{$mode_label}">
					<button type="button" class="bsb-seg__option" data-mode="duration" data-wp-on--click="actions.selectMode" data-wp-class--is-active="state.isModeDuration" data-wp-bind--aria-pressed="state.isModeDuration">{$duration_mode}</button>
					<button type="button" class="bsb-seg__option" data-mode="targetDrop" data-wp-on--click="actions.selectMode" data-wp-class--is-active="state.isModeTargetDrop" data-wp-bind--aria-pressed="state.isModeTargetDrop">{$target_drop_mode}</button>
				</div>
			</section>

			<section class="bsb-field bsb-field--duration" data-wp-bind--hidden="state.isModeTargetDrop">
				<span class="bsb-field__label">{$duration_label}</span>
				<div class="bsb-stepper">
					<button type="button" class="bsb-stepper__btn" data-step="-5" data-wp-on--click="actions.stepDuration" aria-label="{$decrease_label}">&minus;</button>
					<span class="bsb-stepper__readout">
						<span class="bsb-odometer" data-wp-watch="callbacks.rollDuration" aria-hidden="true">
							<span class="bsb-odometer__wheel bsb-odometer__wheel--lead is-collapsed"><span class="bsb-odometer__strip">{$odometer_cells}</span></span>
							<span class="bsb-odometer__wheel bsb-odometer__wheel--lead is-collapsed"><span class="bsb-odometer__strip">{$odometer_cells}</span></span>
							<span class="bsb-odometer__wheel"><span class="bsb-odometer__strip">{$odometer_cells}</span></span>
						</span>
						<span class="bsb-stepper__sr" data-wp-text="state.durationDisplay"></span>
						<span class="bsb-stepper__unit">{$minutes_label}</span>
					</span>
					<button type="button" class="bsb-stepper__btn" data-step="5" data-wp-on--click="actions.stepDuration" aria-label="{$increase_label}">+</button>
				</div>
			</section>

			<section class="bsb-field bsb-field--target" hidden data-wp-bind--hidden="state.isModeDuration">
				<span class="bsb-field__label">{$target_label}</span>
				<div class="bsb-target">
					<span class="bsb-target__gauge">
						<span class="bsb-target__battery" role="slider" tabindex="0" aria-valuemin="5" data-wp-bind--aria-valuemax="state.targetCap" aria-label="{$target_aria}" data-wp-bind--aria-valuenow="context.targetPercent" data-wp-bind--aria-valuetext="state.targetDisplay" data-wp-on--pointerdown="actions.targetPointerDown" data-wp-on--pointermove="actions.targetPointerMove" data-wp-on--pointerup="actions.targetPointerUp" data-wp-on--keydown="actions.targetKeyDown">
							<span class="bsb-target__fill" data-wp-style--width="state.targetDisplay" data-wp-style--background="state.targetColor"></span>
							<span class="bsb-target__handle" data-wp-style--left="state.targetDisplay"></span>
						</span>
						<span class="bsb-target__cap" aria-hidden="true"></span>
					</span>
					<span class="bsb-target__value" data-wp-text="state.targetDisplay" data-wp-style--color="state.targetColor"></span>
				</div>
			</section>

			<section class="bsb-field">
				<label class="bsb-toggle">
					<input type="checkbox" class="bsb-toggle__input" data-wp-bind--checked="context.baseline" data-wp-on--change="actions.toggleBaseline" />
					<span class="bsb-toggle__track"><span class="bsb-toggle__thumb"></span></span>
					<span class="bsb-toggle__text">{$baseline_label}</span>
				</label>
			</section>

			<section class="bsb-field">
				<span class="bsb-field__label">{$speed_label}</span>
				<div class="bsb-seg bsb-seg--speed" role="group" aria-label="{$speed_label}">
					<button type="button" class="bsb-seg__option" data-speed="1" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed1" data-wp-bind--aria-pressed="state.isSpeed1">1&times;</button>
					<button type="button" class="bsb-seg__option" data-speed="4" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed4" data-wp-bind--aria-pressed="state.isSpeed4">4&times;</button>
					<button type="button" class="bsb-seg__option" data-speed="10" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed10" data-wp-bind--aria-pressed="state.isSpeed10">10&times;</button>
				</div>
			</section>
			</div>

			<div class="bsb-deck__status" data-wp-init---clock="callbacks.tick">
				<div class="bsb-deck__status-head">
					<span class="bsb-deck__status-dot" aria-hidden="true"></span>
					<span class="bsb-deck__status-text">{$surfing_label} &middot; <span class="bsb-deck__clock" data-wp-text="state.elapsedClock"></span> {$elapsed_label}</span>
				</div>

				<div class="bsb-deck__readouts">
					<div class="bsb-stat bsb-stat--battery" data-wp-class--is-charging="state.isCharging">
						<span class="bsb-stat__label">{$battery_label}</span>
						<span class="bsb-stat__value bsb-stat__value--lg" data-wp-style--color="state.batteryColor"><span data-wp-text="state.batteryDisplay"></span>%<span class="bsb-stat__bolt" aria-hidden="true"></span></span>
					</div>
					<div class="bsb-stat">
						<span class="bsb-stat__label">{$tte_label}</span>
						<span class="bsb-stat__value" data-wp-text="state.timeToEmptyDisplay"></span>
					</div>
					<div class="bsb-stat">
						<span class="bsb-stat__label">{$rate10_label}</span>
						<span class="bsb-stat__value"><span data-wp-text="state.rate10Display"></span><span class="bsb-stat__unit">%/h</span></span>
					</div>
					<div class="bsb-stat">
						<span class="bsb-stat__label">{$rate_session_label}</span>
						<span class="bsb-stat__value"><span data-wp-text="state.rateSessionDisplay"></span><span class="bsb-stat__unit">%/h</span></span>
					</div>
				</div>

				<span class="bsb-deck__waves" aria-hidden="true" data-wp-style----bsb-wave-speed="context.speed">
					<span class="bsb-deck__wave bsb-deck__wave--back"></span>
					<span class="bsb-deck__wave bsb-deck__wave--mid"></span>
					<span class="bsb-deck__wave bsb-deck__wave--front"></span>
				</span>
			</div>
			</div>
		</div>

		<footer class="bsb-deck__foot">
			<button type="button" class="bsb-run" data-wp-on--click="actions.toggleRun" data-wp-class--is-running="state.isRunning" data-wp-class--is-blocked="state.isStartBlocked" data-wp-bind--disabled="state.isStartBlocked">
				<span class="bsb-run__glyph" aria-hidden="true"></span>
				<span class="bsb-run__text bsb-run__text--start">{$start_label}</span>
				<span class="bsb-run__text bsb-run__text--stop">{$stop_label}</span>
				<span class="bsb-run__text bsb-run__text--blocked">{$plugged_label}</span>
			</button>
		</footer>
	</aside>

	<div class="bsb-cockpit__stage">
		<iframe class="bsb-cockpit__viewport" title="{$viewport_title}" data-wp-bind--src="state.currentSrc"></iframe>
	</div>
</div>
HTML;
	}
}
