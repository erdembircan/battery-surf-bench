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
 * controls — mode, duration, baseline calibration, speed and stop — each wired
 * to the client store ({@see src/cockpit/view.ts}); the stage carries the page
 * label, the cycle control and the viewport iframe. The block's server render
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
	 *     @type string $mode_label        Translated, escaped label for the mode field.
	 *     @type string $duration_mode     Translated, escaped label for the duration mode option.
	 *     @type string $target_drop_mode  Translated, escaped label for the target-drop mode option.
	 *     @type string $duration_label    Translated, escaped label for the duration field.
	 *     @type string $minutes_label     Translated, escaped unit label for the duration readout.
	 *     @type string $decrease_label    Translated, escaped accessible label for the decrease control.
	 *     @type string $increase_label    Translated, escaped accessible label for the increase control.
	 *     @type string $baseline_label    Translated, escaped label for the baseline calibration toggle.
	 *     @type string $speed_label       Translated, escaped label for the speed field.
	 *     @type string $surfing_label     Translated, escaped "Surfing" word for the running indicator.
	 *     @type string $elapsed_label     Translated, escaped "elapsed" word for the running indicator.
	 *     @type string $stop_label        Translated, escaped label for the stop control.
	 *     @type string $next_label        Translated, escaped label for the next-page control.
	 *     @type string $viewport_title    Translated, escaped title for the viewport iframe.
	 * }
	 * @return string The block's HTML.
	 */
	public function render( array $data = array() ): string {
		$wrapper          = isset( $data['wrapper'] ) ? (string) $data['wrapper'] : '';
		$context          = isset( $data['context'] ) ? (string) $data['context'] : '';
		$brand_title      = isset( $data['brand_title'] ) ? (string) $data['brand_title'] : '';
		$brand_subtitle   = isset( $data['brand_subtitle'] ) ? (string) $data['brand_subtitle'] : '';
		$mode_label       = isset( $data['mode_label'] ) ? (string) $data['mode_label'] : '';
		$duration_mode    = isset( $data['duration_mode'] ) ? (string) $data['duration_mode'] : '';
		$target_drop_mode = isset( $data['target_drop_mode'] ) ? (string) $data['target_drop_mode'] : '';
		$duration_label   = isset( $data['duration_label'] ) ? (string) $data['duration_label'] : '';
		$minutes_label    = isset( $data['minutes_label'] ) ? (string) $data['minutes_label'] : '';
		$decrease_label   = isset( $data['decrease_label'] ) ? (string) $data['decrease_label'] : '';
		$increase_label   = isset( $data['increase_label'] ) ? (string) $data['increase_label'] : '';
		$baseline_label   = isset( $data['baseline_label'] ) ? (string) $data['baseline_label'] : '';
		$speed_label      = isset( $data['speed_label'] ) ? (string) $data['speed_label'] : '';
		$surfing_label    = isset( $data['surfing_label'] ) ? (string) $data['surfing_label'] : '';
		$elapsed_label    = isset( $data['elapsed_label'] ) ? (string) $data['elapsed_label'] : '';
		$stop_label       = isset( $data['stop_label'] ) ? (string) $data['stop_label'] : '';
		$next_label       = isset( $data['next_label'] ) ? (string) $data['next_label'] : '';
		$viewport_title   = isset( $data['viewport_title'] ) ? (string) $data['viewport_title'] : '';

		return <<<HTML
<div {$wrapper} data-wp-interactive="bsb/cockpit" {$context}>
	<aside class="bsb-cockpit__deck">
		<header class="bsb-deck__brand">
			<span class="bsb-deck__mark" aria-hidden="true"></span>
			<span class="bsb-deck__wordmark">
				<span class="bsb-deck__title">{$brand_title}</span>
				<span class="bsb-deck__subtitle">{$brand_subtitle}</span>
			</span>
		</header>

		<div class="bsb-deck__body">
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
						<span class="bsb-stepper__value" data-wp-text="state.durationDisplay"></span>
						<span class="bsb-stepper__unit">{$minutes_label}</span>
					</span>
					<button type="button" class="bsb-stepper__btn" data-step="5" data-wp-on--click="actions.stepDuration" aria-label="{$increase_label}">+</button>
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

			<div class="bsb-deck__status" data-wp-init="callbacks.tick">
				<span class="bsb-deck__status-dot" aria-hidden="true"></span>
				<span class="bsb-deck__status-text">{$surfing_label} &middot; <span class="bsb-deck__clock" data-wp-text="state.elapsedClock"></span> {$elapsed_label}</span>
				<span class="bsb-deck__waves" aria-hidden="true">
					<span class="bsb-deck__wave bsb-deck__wave--back"></span>
					<span class="bsb-deck__wave bsb-deck__wave--mid"></span>
					<span class="bsb-deck__wave bsb-deck__wave--front"></span>
				</span>
			</div>
		</div>

		<footer class="bsb-deck__foot">
			<button type="button" class="bsb-stop" data-wp-on--click="actions.stop">
				<span class="bsb-stop__glyph" aria-hidden="true"></span>
				<span class="bsb-stop__text">{$stop_label}</span>
			</button>
		</footer>
	</aside>

	<div class="bsb-cockpit__stage">
		<div class="bsb-stage__bar">
			<span class="bsb-stage__label" data-wp-text="state.currentLabel"></span>
			<button type="button" class="bsb-stage__cycle" data-wp-on--click="actions.next">{$next_label}</button>
		</div>
		<iframe class="bsb-cockpit__viewport" title="{$viewport_title}" data-wp-bind--src="state.currentSrc"></iframe>
	</div>
</div>
HTML;
	}
}
