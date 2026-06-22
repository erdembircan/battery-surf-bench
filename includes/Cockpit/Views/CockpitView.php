<?php
/**
 * Cockpit block view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_attr;
use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the `bsb/cockpit` block's front-end markup: the Interactivity-driven
 * region split into a control deck and a surf stage. The deck carries the run
 * controls — mode, duration, baseline calibration, speed and a start/stop
 * control — each wired to the client store ({@see src/cockpit/view.ts}). While a
 * run is live the configuration controls give way to the live readouts pill; the
 * stage carries the viewport iframe. The block's server render
 * template ({@see src/cockpit/render.php}) prepares the dynamic, raw (translated)
 * values — wrapper attributes, the per-instance `data-wp-context`, and the
 * translated labels — and hands them here; this view owns the structure and the
 * escaping, held in a heredoc, so no HTML is written or escaped inline in the
 * render template.
 */
class CockpitView implements View {

	/**
	 * Renders the cockpit block markup.
	 *
	 * @param array<string, mixed> $data {
	 *     Raw (translated) values from the block render template; this view escapes
	 *     each into its slot (text with esc_html, attributes with esc_attr).
	 *
	 *     @type string $wrapper           Block wrapper attributes from `get_block_wrapper_attributes()`.
	 *     @type string $context           `data-wp-context` attribute from `wp_interactivity_data_wp_context()`.
	 *     @type string $brand_title       Translated plugin name shown in the deck brand.
	 *     @type string $brand_subtitle    Translated "Cockpit" label under the brand.
	 *     @type string $mode_label        Translated label for the mode field.
	 *     @type string $duration_mode     Translated label for the duration mode option.
	 *     @type string $target_drop_mode  Translated label for the target-drop mode option.
	 *     @type string $duration_label    Translated label for the duration field.
	 *     @type string $minutes_label     Translated unit label for the duration readout.
	 *     @type string $decrease_label    Translated accessible label for the decrease control.
	 *     @type string $increase_label    Translated accessible label for the increase control.
	 *     @type string $target_label      Translated label for the target-drop field.
	 *     @type string $target_aria       Translated accessible label for the target slider.
	 *     @type string $baseline_label    Translated label for the baseline calibration toggle.
	 *     @type string $speed_label        Translated label for the speed field.
	 *     @type string $battery_label      Translated label for the battery readout.
	 *     @type string $rate10_label       Translated label for the 10-minute drain rate.
	 *     @type string $rate_session_label Translated label for the session drain rate.
	 *     @type string $tte_label          Translated label for the time-to-empty readout.
	 *     @type string $target_short_label Translated label for the target readout (target-drop mode).
	 *     @type string $surfing_label     Translated "Surfing" word for the running indicator.
	 *     @type string $elapsed_label     Translated "elapsed" word (target-drop mode clock).
	 *     @type string $remaining_label   Translated "left" word (duration-mode countdown clock).
	 *     @type string $start_label       Translated label for the run control when idle.
	 *     @type string $stop_label        Translated label for the run control when running.
	 *     @type string $plugged_label     Translated run-control label when blocked by charging.
	 *     @type string $compact_label     Translated accessible label for the compact control.
	 *     @type string $expand_label      Translated accessible label for the expand control.
	 *     @type string $viewport_title    Translated title for the viewport iframe.
	 *     @type string $shield_label      Translated "view only" chip text over the viewport.
	 *     @type string $greeting_lead     Translated "Greetings from" line of the idle postcard.
	 *     @type string $idle_heading      Translated heading on the idle postcard back.
	 *     @type string $idle_subtitle     Translated subtitle under the idle heading.
	 *     @type string $idle_step1_title  Translated title of idle step 1.
	 *     @type string $idle_step1_text   Translated body of idle step 1.
	 *     @type string $idle_step2_title  Translated title of idle step 2.
	 *     @type string $idle_step2_text   Translated body of idle step 2.
	 *     @type string $idle_step3_title  Translated title of idle step 3.
	 *     @type string $idle_step3_text   Translated body of idle step 3.
	 *     @type string $idle_notice_title Translated title of the keep-awake notice.
	 *     @type string $idle_notice_text  Translated body of the keep-awake notice.
	 *     @type string $measured_label    Translated legend label for the measured drain series.
	 *     @type string $projected_label   Translated legend label for the 100→0 projection.
	 * }
	 * @return string The block's HTML.
	 */
	public function render( array $data = array() ): string {
		$wrapper            = isset( $data['wrapper'] ) ? (string) $data['wrapper'] : '';
		$context            = isset( $data['context'] ) ? (string) $data['context'] : '';
		$brand_title        = isset( $data['brand_title'] ) ? (string) $data['brand_title'] : '';
		$brand_subtitle     = isset( $data['brand_subtitle'] ) ? (string) $data['brand_subtitle'] : '';
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
		$target_short_label = isset( $data['target_short_label'] ) ? (string) $data['target_short_label'] : '';
		$surfing_label      = isset( $data['surfing_label'] ) ? (string) $data['surfing_label'] : '';
		$elapsed_label      = isset( $data['elapsed_label'] ) ? (string) $data['elapsed_label'] : '';
		$remaining_label    = isset( $data['remaining_label'] ) ? (string) $data['remaining_label'] : '';
		$start_label        = isset( $data['start_label'] ) ? (string) $data['start_label'] : '';
		$stop_label         = isset( $data['stop_label'] ) ? (string) $data['stop_label'] : '';
		$plugged_label      = isset( $data['plugged_label'] ) ? (string) $data['plugged_label'] : '';
		$compact_label      = isset( $data['compact_label'] ) ? (string) $data['compact_label'] : '';
		$expand_label       = isset( $data['expand_label'] ) ? (string) $data['expand_label'] : '';
		$viewport_title     = isset( $data['viewport_title'] ) ? (string) $data['viewport_title'] : '';
		$shield_label       = isset( $data['shield_label'] ) ? (string) $data['shield_label'] : '';
		$greeting_lead      = isset( $data['greeting_lead'] ) ? (string) $data['greeting_lead'] : '';
		$idle_heading       = isset( $data['idle_heading'] ) ? (string) $data['idle_heading'] : '';
		$idle_subtitle      = isset( $data['idle_subtitle'] ) ? (string) $data['idle_subtitle'] : '';
		$idle_step1_title   = isset( $data['idle_step1_title'] ) ? (string) $data['idle_step1_title'] : '';
		$idle_step1_text    = isset( $data['idle_step1_text'] ) ? (string) $data['idle_step1_text'] : '';
		$idle_step2_title   = isset( $data['idle_step2_title'] ) ? (string) $data['idle_step2_title'] : '';
		$idle_step2_text    = isset( $data['idle_step2_text'] ) ? (string) $data['idle_step2_text'] : '';
		$idle_step3_title   = isset( $data['idle_step3_title'] ) ? (string) $data['idle_step3_title'] : '';
		$idle_step3_text    = isset( $data['idle_step3_text'] ) ? (string) $data['idle_step3_text'] : '';
		$idle_notice_title  = isset( $data['idle_notice_title'] ) ? (string) $data['idle_notice_title'] : '';
		$idle_notice_text   = isset( $data['idle_notice_text'] ) ? (string) $data['idle_notice_text'] : '';
		$dropped_label      = isset( $data['dropped_label'] ) ? (string) $data['dropped_label'] : '';
		$pts_label          = isset( $data['pts_label'] ) ? (string) $data['pts_label'] : '';
		$elapsed_run_label  = isset( $data['elapsed_run_label'] ) ? (string) $data['elapsed_run_label'] : '';
		$new_run_label      = isset( $data['new_run_label'] ) ? (string) $data['new_run_label'] : '';
		$flip_label         = isset( $data['flip_label'] ) ? (string) $data['flip_label'] : '';
		$summary_brand      = isset( $data['summary_brand'] ) ? (string) $data['summary_brand'] : '';
		$measured_label     = isset( $data['measured_label'] ) ? (string) $data['measured_label'] : '';
		$projected_label    = isset( $data['projected_label'] ) ? (string) $data['projected_label'] : '';

		// Shared postcard components, rendered once and placed in both the idle
		// postcard and the run-summary card so the illustration and the stamp are a
		// single source, not divergent copies. They are built from the raw values
		// first — each child view escapes what it is handed — before this view
		// escapes the same values for its own slots below.
		$photo      = ( new PostcardPhoto() )->render(
			array(
				'greeting_lead' => $greeting_lead,
				'brand_title'   => $brand_title,
			)
		);
		$photo_fill = ( new PostcardPhoto() )->render(
			array(
				'greeting_lead' => $greeting_lead,
				'brand_title'   => $brand_title,
				'modifier'      => 'bsb-photo--fill',
			)
		);
		$frank      = ( new FrankedStamp() )->render( array( 'brand' => $summary_brand ) );

		// This view owns its markup, so it escapes every value it interpolates:
		// text slots with esc_html(), attribute slots with esc_attr(). The wrapper
		// attributes and the data-wp-context attribute arrive pre-built by WordPress
		// and stay as-is, as do the composed child-view markups above. `mode_label`
		// and `speed_label` appear in both a text slot and an aria-label, so each
		// also gets an attribute-escaped variant.
		$mode_label_attr    = esc_attr( $mode_label );
		$speed_label_attr   = esc_attr( $speed_label );
		$brand_title        = esc_html( $brand_title );
		$brand_subtitle     = esc_html( $brand_subtitle );
		$mode_label         = esc_html( $mode_label );
		$duration_mode      = esc_html( $duration_mode );
		$target_drop_mode   = esc_html( $target_drop_mode );
		$duration_label     = esc_html( $duration_label );
		$minutes_label      = esc_html( $minutes_label );
		$decrease_label     = esc_attr( $decrease_label );
		$increase_label     = esc_attr( $increase_label );
		$target_label       = esc_html( $target_label );
		$target_aria        = esc_attr( $target_aria );
		$baseline_label     = esc_html( $baseline_label );
		$speed_label        = esc_html( $speed_label );
		$battery_label      = esc_html( $battery_label );
		$rate10_label       = esc_html( $rate10_label );
		$rate_session_label = esc_html( $rate_session_label );
		$tte_label          = esc_html( $tte_label );
		$target_short_label = esc_html( $target_short_label );
		$surfing_label      = esc_html( $surfing_label );
		$elapsed_label      = esc_html( $elapsed_label );
		$remaining_label    = esc_html( $remaining_label );
		$start_label        = esc_html( $start_label );
		$stop_label         = esc_html( $stop_label );
		$plugged_label      = esc_html( $plugged_label );
		$compact_label      = esc_attr( $compact_label );
		$expand_label       = esc_attr( $expand_label );
		$viewport_title     = esc_attr( $viewport_title );
		$shield_label       = esc_html( $shield_label );
		$idle_heading       = esc_html( $idle_heading );
		$idle_subtitle      = esc_html( $idle_subtitle );
		$idle_step1_title   = esc_html( $idle_step1_title );
		$idle_step1_text    = esc_html( $idle_step1_text );
		$idle_step2_title   = esc_html( $idle_step2_title );
		$idle_step2_text    = esc_html( $idle_step2_text );
		$idle_step3_title   = esc_html( $idle_step3_title );
		$idle_step3_text    = esc_html( $idle_step3_text );
		$idle_notice_title  = esc_html( $idle_notice_title );
		$idle_notice_text   = esc_html( $idle_notice_text );
		$dropped_label      = esc_html( $dropped_label );
		$pts_label          = esc_html( $pts_label );
		$elapsed_run_label  = esc_html( $elapsed_run_label );
		$new_run_label      = esc_html( $new_run_label );
		$flip_label         = esc_html( $flip_label );
		$measured_label     = esc_html( $measured_label );
		$projected_label    = esc_html( $projected_label );

		// Each duration-odometer wheel is a strip of 0–9 repeated three times; the
		// client store (rollDuration) slides it to roll the digit. Built here so
		// the wheel markup stays a single repeated unit owned by the view.
		$bsb_digit_cells = <<<'CELLS'
<span class="bsb-odometer__cell">0</span><span class="bsb-odometer__cell">1</span><span class="bsb-odometer__cell">2</span><span class="bsb-odometer__cell">3</span><span class="bsb-odometer__cell">4</span><span class="bsb-odometer__cell">5</span><span class="bsb-odometer__cell">6</span><span class="bsb-odometer__cell">7</span><span class="bsb-odometer__cell">8</span><span class="bsb-odometer__cell">9</span>
CELLS;
		$odometer_cells  = str_repeat( $bsb_digit_cells, 3 );

		// The live readouts — status line, the four metrics and the parallax
		// waves. Built once and rendered in two places: the deck's vertical pill
		// (normal) and the stage's horizontal top pill (compact). Both bind to the
		// same store getters, so the readings stay in lock-step.
		$pill_inner = <<<INNER
<div class="bsb-deck__status-head">
				<span class="bsb-deck__status-dot" aria-hidden="true"></span>
				<span class="bsb-deck__status-text">{$surfing_label} &middot; <span class="bsb-deck__clock" data-wp-text="state.runClock"></span> <span data-wp-bind--hidden="state.isModeDuration">{$elapsed_label}</span><span data-wp-bind--hidden="state.isModeTargetDrop">{$remaining_label}</span></span>
			</div>

			<div class="bsb-deck__readouts">
				<div class="bsb-stat bsb-stat--battery" data-wp-class--is-charging="state.isCharging">
					<span class="bsb-stat__label">{$battery_label}</span>
					<span class="bsb-stat__value bsb-stat__value--lg" data-wp-style--color="state.batteryColor"><span data-wp-text="state.batteryDisplay"></span>%<span class="bsb-stat__bolt" aria-hidden="true"></span></span>
				</div>
				<div class="bsb-stat bsb-stat--target" data-wp-bind--hidden="state.isModeDuration">
					<span class="bsb-stat__label">{$target_short_label}</span>
					<span class="bsb-stat__value" data-wp-text="state.targetDisplay" data-wp-style--color="state.targetColor"></span>
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
INNER;

		return <<<HTML
<div {$wrapper} data-wp-interactive="bsb/cockpit" {$context} data-wp-init---battery="callbacks.initBattery" data-wp-init---wake-lock="callbacks.initWakeLock" data-wp-watch---run-activity="callbacks.syncRunActivity" data-wp-class--is-compact="state.isCompact">
	<aside class="bsb-cockpit__deck">
		<header class="bsb-deck__brand">
			<span class="bsb-deck__mark" aria-hidden="true"></span>
			<span class="bsb-deck__title">{$brand_title}</span>
			<span class="bsb-deck__subtitle">{$brand_subtitle}</span>
			<span class="bsb-deck__actions">
				<button type="button" class="bsb-deck__compact" data-wp-on--click="actions.toggleCompact" data-wp-class--is-hidden="state.isIdle" aria-label="{$compact_label}"></button>
			</span>
		</header>

		<div class="bsb-deck__body">
			<div class="bsb-deck__swap" data-wp-class--is-running="state.isRunning">
			<div class="bsb-deck__config">
			<section class="bsb-field">
				<span class="bsb-field__label">{$mode_label}</span>
				<div class="bsb-seg" role="group" aria-label="{$mode_label_attr}">
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
				<div class="bsb-seg bsb-seg--speed" role="group" aria-label="{$speed_label_attr}">
					<button type="button" class="bsb-seg__option" data-speed="1" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed1" data-wp-bind--aria-pressed="state.isSpeed1">1&times;</button>
					<button type="button" class="bsb-seg__option" data-speed="4" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed4" data-wp-bind--aria-pressed="state.isSpeed4">4&times;</button>
					<button type="button" class="bsb-seg__option" data-speed="10" data-wp-on--click="actions.selectSpeed" data-wp-class--is-active="state.isSpeed10" data-wp-bind--aria-pressed="state.isSpeed10">10&times;</button>
				</div>
			</section>
			</div>

			<div class="bsb-deck__status">
			{$pill_inner}
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
		<div class="bsb-cockpit__topbar">
			<div class="bsb-deck__status">
			{$pill_inner}
				<div class="bsb-deck__readout-ctrl">
					<button type="button" class="bsb-deck__readout-stop" data-wp-on--click="actions.toggleRun">{$stop_label}</button>
					<button type="button" class="bsb-deck__expand" data-wp-on--click="actions.toggleCompact" aria-label="{$expand_label}"></button>
				</div>
			</div>
		</div>
		<div class="bsb-cockpit__idle" data-wp-bind--hidden="state.isRunning">
			<div class="bsb-cockpit__postcard">
				{$photo}
				<div class="bsb-cockpit__postcard-note">
					<span class="bsb-cockpit__stamp" aria-hidden="true"></span>
					<h2 class="bsb-cockpit__postcard-heading">{$idle_heading}</h2>
					<p class="bsb-cockpit__postcard-subtitle">{$idle_subtitle}</p>
					<span class="bsb-cockpit__postcard-divide" aria-hidden="true"></span>
					<ol class="bsb-cockpit__postcard-steps">
						<li><span class="bsb-cockpit__postcard-num">1</span><span class="bsb-cockpit__postcard-step"><b>{$idle_step1_title}</b>{$idle_step1_text}</span></li>
						<li><span class="bsb-cockpit__postcard-num">2</span><span class="bsb-cockpit__postcard-step"><b>{$idle_step2_title}</b>{$idle_step2_text}</span></li>
						<li><span class="bsb-cockpit__postcard-num">3</span><span class="bsb-cockpit__postcard-step"><b>{$idle_step3_title}</b>{$idle_step3_text}</span></li>
					</ol>
					<p class="bsb-cockpit__postcard-notice"><b>{$idle_notice_title}</b>{$idle_notice_text}</p>
				</div>
			</div>
		</div>
		<div class="bsb-cockpit__viewport-wrap" hidden data-wp-bind--hidden="state.isIdle">
			<iframe class="bsb-cockpit__viewport" title="{$viewport_title}" data-wp-bind--src="state.currentSrc"></iframe>
			<div class="bsb-cockpit__shield" aria-hidden="true"></div>
			<p class="bsb-cockpit__shield-badge">{$shield_label}</p>
		</div>
	</div>

	<div class="bsb-summary" hidden data-wp-bind--hidden="!state.isEnded" data-wp-watch="callbacks.renderSummary">
		<div class="bsb-summary__card" data-wp-class--is-flipped="state.isFlipped">
			<div class="bsb-summary__face bsb-summary__face--front">
				{$photo_fill}
				<button type="button" class="bsb-summary__flip" data-wp-on--click="actions.toggleFlip"><span class="bsb-summary__flip-icon" aria-hidden="true"></span>{$flip_label}</button>
			</div>
			<div class="bsb-summary__face bsb-summary__face--back">
				{$frank}
				<div class="bsb-summary__report">
					<h2 class="bsb-summary__head" data-wp-text="state.summaryHeading"></h2>
					<p class="bsb-summary__sig" data-wp-text="state.summarySig"></p>
					<span class="bsb-summary__divide" aria-hidden="true"></span>
					<div class="bsb-summary__graph" data-wp-bind--hidden="!context.hasGraph">
						<svg class="bsb-summary__chart" viewBox="0 0 480 90" aria-hidden="true"></svg>
						<div class="bsb-summary__legend" aria-hidden="true">
							<span class="bsb-summary__legend-item"><span class="bsb-summary__legend-swatch"></span>{$measured_label}</span>
							<span class="bsb-summary__legend-item"><span class="bsb-summary__legend-swatch bsb-summary__legend-swatch--fit"></span>{$projected_label}</span>
						</div>
					</div>
					<div class="bsb-summary__stats">
						<div class="bsb-stat"><span class="bsb-stat__label">{$tte_label}</span><span class="bsb-stat__value" data-wp-text="state.timeToEmptyDisplay"></span></div>
						<div class="bsb-stat"><span class="bsb-stat__label">{$rate_session_label}</span><span class="bsb-stat__value"><span data-wp-text="state.rateSessionDisplay"></span><span class="bsb-stat__unit">%/h</span></span></div>
						<div class="bsb-stat"><span class="bsb-stat__label">{$rate10_label}</span><span class="bsb-stat__value"><span data-wp-text="state.rate10Display"></span><span class="bsb-stat__unit">%/h</span></span></div>
						<div class="bsb-stat"><span class="bsb-stat__label">{$battery_label}</span><span class="bsb-stat__value bsb-stat__value--arrow"><span data-wp-text="context.summaryBatteryStart"></span><span class="bsb-stat__arrow" aria-hidden="true"></span><span data-wp-text="context.summaryBatteryEnd"></span></span></div>
						<div class="bsb-stat"><span class="bsb-stat__label">{$dropped_label}</span><span class="bsb-stat__value"><span data-wp-text="context.summaryDropped"></span><span class="bsb-stat__unit">{$pts_label}</span></span></div>
						<div class="bsb-stat"><span class="bsb-stat__label">{$elapsed_run_label}</span><span class="bsb-stat__value" data-wp-text="state.summaryElapsed"></span></div>
					</div>
					<div class="bsb-summary__actions">
						<button type="button" class="bsb-summary__new" data-wp-on--click="actions.newRun">{$new_run_label}</button>
					</div>
				</div>
				<button type="button" class="bsb-summary__flip bsb-summary__flip--paper" data-wp-on--click="actions.toggleFlip"><span class="bsb-summary__flip-icon" aria-hidden="true"></span>{$flip_label}</button>
			</div>
		</div>
	</div>
</div>
HTML;
	}
}
