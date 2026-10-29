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
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the `bsb/cockpit` block's front-end markup: the Interactivity-driven
 * region split into a control deck and a surf stage. The deck carries the run
 * controls — mode, duration, speed and a start/stop
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
	 *     @type string $speed_label        Translated label for the speed field.
	 *     @type string $battery_label      Translated label for the battery readout.
	 *     @type string $rate10_label       Translated label for the 10-minute drain rate.
	 *     @type string $rate_session_label Translated label for the session drain rate.
	 *     @type string $tte_label          Translated label for the time-to-empty readout.
	 *     @type string $target_short_label Translated label for the target readout (target-drop mode).
	 *     @type string $surfing_label     Translated "Surfing" word for the running indicator.
	 *     @type string $sterile_label     Translated "Sterile" status-head chip text, shown only during a sterile run.
	 *     @type string $elapsed_label     Translated "elapsed" word (target-drop mode clock).
	 *     @type string $remaining_label   Translated "left" word (duration-mode countdown clock).
	 *     @type string $start_label       Translated label for the run control when idle.
	 *     @type string $stop_label        Translated label for the run control when running.
	 *     @type string $plugged_label     Translated run-control label when blocked by charging.
	 *     @type string $compact_label     Translated accessible label for the compact control.
	 *     @type string $expand_label      Translated accessible label for the expand control.
	 *     @type string $sound_label       Translated accessible label for the finish-sound toggle.
	 *     @type string $viewport_title    Translated title for the viewport iframe.
	 *     @type string $toast_dismiss_label Translated accessible label for the toast's dismiss button.
	 *     @type string $greeting_lead     Translated "Greetings from" line of the idle postcard.
	 *     @type string $idle_heading      Translated heading on the idle postcard back.
	 *     @type string $idle_subtitle     Translated subtitle under the idle heading.
	 *     @type string $idle_step1_title  Translated title of idle step 1.
	 *     @type string $idle_step1_text   Translated body of idle step 1.
	 *     @type string $idle_step2_title  Translated title of idle step 2.
	 *     @type string $idle_step2_text   Translated body of idle step 2.
	 *     @type string $idle_step3_title  Translated title of idle step 3.
	 *     @type string $idle_step3_text   Translated body of idle step 3.
	 *     @type string $idle_notice_title    Translated title of the keep-awake notice.
	 *     @type string $idle_notice_text     Translated body of the keep-awake notice.
	 *     @type string $unsupported_heading  Translated heading on the unsupported-browser warning back.
	 *     @type string $unsupported_subtitle Translated subtitle under the unsupported heading.
	 *     @type string $unsupported_lead     Translated lead clause (bold) of the unsupported body.
	 *     @type string $unsupported_body     Translated remainder of the unsupported body.
	 *     @type string $unsupported_browsers Translated "open in Chrome or Edge" hint.
	 *     @type string $unsupported_arc      Translated lower-arc label of the warning postmark.
	 *     @type string $unsupported_mark     Translated centre value of the warning postmark.
	 *     @type string $unsupported_unit     Translated centre unit of the warning postmark.
	 *     @type string $measured_label       Translated legend label for the measured drain series.
	 *     @type string $projected_label      Translated legend label for the 100→0 projection.
	 * }
	 * @return string The block's HTML.
	 */
	public function render( array $data = array() ): string {
		$wrapper             = isset( $data['wrapper'] ) ? (string) $data['wrapper'] : '';
		$context             = isset( $data['context'] ) ? (string) $data['context'] : '';
		$brand_title         = isset( $data['brand_title'] ) ? (string) $data['brand_title'] : '';
		$brand_subtitle      = isset( $data['brand_subtitle'] ) ? (string) $data['brand_subtitle'] : '';
		$mode_label          = isset( $data['mode_label'] ) ? (string) $data['mode_label'] : '';
		$duration_mode       = isset( $data['duration_mode'] ) ? (string) $data['duration_mode'] : '';
		$target_drop_mode    = isset( $data['target_drop_mode'] ) ? (string) $data['target_drop_mode'] : '';
		$duration_label      = isset( $data['duration_label'] ) ? (string) $data['duration_label'] : '';
		$minutes_label       = isset( $data['minutes_label'] ) ? (string) $data['minutes_label'] : '';
		$decrease_label      = isset( $data['decrease_label'] ) ? (string) $data['decrease_label'] : '';
		$increase_label      = isset( $data['increase_label'] ) ? (string) $data['increase_label'] : '';
		$target_label        = isset( $data['target_label'] ) ? (string) $data['target_label'] : '';
		$target_aria         = isset( $data['target_aria'] ) ? (string) $data['target_aria'] : '';
		$speed_label         = isset( $data['speed_label'] ) ? (string) $data['speed_label'] : '';
		$battery_label       = isset( $data['battery_label'] ) ? (string) $data['battery_label'] : '';
		$rate10_label        = isset( $data['rate10_label'] ) ? (string) $data['rate10_label'] : '';
		$rate_session_label  = isset( $data['rate_session_label'] ) ? (string) $data['rate_session_label'] : '';
		$tte_label           = isset( $data['tte_label'] ) ? (string) $data['tte_label'] : '';
		$target_short_label  = isset( $data['target_short_label'] ) ? (string) $data['target_short_label'] : '';
		$surfing_label       = isset( $data['surfing_label'] ) ? (string) $data['surfing_label'] : '';
		$sterile_label       = isset( $data['sterile_label'] ) ? (string) $data['sterile_label'] : '';
		$elapsed_label       = isset( $data['elapsed_label'] ) ? (string) $data['elapsed_label'] : '';
		$remaining_label     = isset( $data['remaining_label'] ) ? (string) $data['remaining_label'] : '';
		$start_label         = isset( $data['start_label'] ) ? (string) $data['start_label'] : '';
		$stop_label          = isset( $data['stop_label'] ) ? (string) $data['stop_label'] : '';
		$plugged_label       = isset( $data['plugged_label'] ) ? (string) $data['plugged_label'] : '';
		$compact_label       = isset( $data['compact_label'] ) ? (string) $data['compact_label'] : '';
		$expand_label        = isset( $data['expand_label'] ) ? (string) $data['expand_label'] : '';
		$sound_label         = isset( $data['sound_label'] ) ? (string) $data['sound_label'] : '';
		$viewport_title      = isset( $data['viewport_title'] ) ? (string) $data['viewport_title'] : '';
		$toast_dismiss_label = isset( $data['toast_dismiss_label'] ) ? (string) $data['toast_dismiss_label'] : '';
		$greeting_lead       = isset( $data['greeting_lead'] ) ? (string) $data['greeting_lead'] : '';
		$idle_heading        = isset( $data['idle_heading'] ) ? (string) $data['idle_heading'] : '';
		$idle_subtitle       = isset( $data['idle_subtitle'] ) ? (string) $data['idle_subtitle'] : '';
		$idle_step1_title    = isset( $data['idle_step1_title'] ) ? (string) $data['idle_step1_title'] : '';
		$idle_step1_text     = isset( $data['idle_step1_text'] ) ? (string) $data['idle_step1_text'] : '';
		$idle_step2_title    = isset( $data['idle_step2_title'] ) ? (string) $data['idle_step2_title'] : '';
		$idle_step2_text     = isset( $data['idle_step2_text'] ) ? (string) $data['idle_step2_text'] : '';
		$idle_step3_title    = isset( $data['idle_step3_title'] ) ? (string) $data['idle_step3_title'] : '';
		$idle_step3_text     = isset( $data['idle_step3_text'] ) ? (string) $data['idle_step3_text'] : '';
		$idle_notice_title   = isset( $data['idle_notice_title'] ) ? (string) $data['idle_notice_title'] : '';
		$idle_notice_text    = isset( $data['idle_notice_text'] ) ? (string) $data['idle_notice_text'] : '';
		$unsupported_head    = isset( $data['unsupported_heading'] ) ? (string) $data['unsupported_heading'] : '';
		$unsupported_sub     = isset( $data['unsupported_subtitle'] ) ? (string) $data['unsupported_subtitle'] : '';
		$unsupported_lead    = isset( $data['unsupported_lead'] ) ? (string) $data['unsupported_lead'] : '';
		$unsupported_body    = isset( $data['unsupported_body'] ) ? (string) $data['unsupported_body'] : '';
		$unsupported_browse  = isset( $data['unsupported_browsers'] ) ? (string) $data['unsupported_browsers'] : '';
		$unsupported_arc     = isset( $data['unsupported_arc'] ) ? (string) $data['unsupported_arc'] : '';
		$unsupported_mark    = isset( $data['unsupported_mark'] ) ? (string) $data['unsupported_mark'] : '';
		$unsupported_unit    = isset( $data['unsupported_unit'] ) ? (string) $data['unsupported_unit'] : '';
		$new_run_label       = isset( $data['new_run_label'] ) ? (string) $data['new_run_label'] : '';
		$summary_brand       = isset( $data['summary_brand'] ) ? (string) $data['summary_brand'] : '';
		$surfer_label        = isset( $data['surfer_label'] ) ? (string) $data['surfer_label'] : '';
		$customize_label     = isset( $data['customize_label'] ) ? (string) $data['customize_label'] : '';
		$reset_label         = isset( $data['reset_label'] ) ? (string) $data['reset_label'] : '';
		$points_label        = isset( $data['points_label'] ) ? (string) $data['points_label'] : '';
		$trait_stats         = isset( $data['trait_stats'] ) && is_array( $data['trait_stats'] ) ? $data['trait_stats'] : array();
		$trait_classes       = isset( $data['trait_classes'] ) && is_array( $data['trait_classes'] ) ? $data['trait_classes'] : array();

		// Shared postcard components, rendered once and placed in both the startup
		// postcard and the run-summary card so the illustration and the stamp are a
		// single source, not divergent copies. They are built from the raw values
		// first — each child view escapes what it is handed — before this view
		// escapes the same values for its own slots below. The photo fills a flip
		// face in both places; the summary stamp is franked (a cancellation reads
		// as "the run is done") while the startup stamp is left blank.
		$photo_fill  = ( new PostcardPhoto() )->render(
			array(
				'greeting_lead' => $greeting_lead,
				'brand_title'   => $brand_title,
				'modifier'      => 'bsb-photo--fill',
			)
		);
		$frank       = ( new FrankedStamp() )->render( array( 'brand' => $summary_brand ) );
		$frank_blank = ( new FrankedStamp() )->render( array( 'cancel_enabled' => false ) );
		// The unsupported-browser warning franks its back with the same postmark,
		// recoloured red and lettered server-side (a fixed, non-reactive stamp,
		// unlike the summary's, which a watch paints).
		$frank_warning = ( new FrankedStamp() )->render(
			array(
				'brand'    => $summary_brand,
				'arc'      => $unsupported_arc,
				'val'      => $unsupported_mark,
				'unit'     => $unsupported_unit,
				'modifier' => 'bsb-frank--warning',
			)
		);

		// This view owns its markup, so it escapes every value it interpolates:
		// text slots with esc_html(), attribute slots with esc_attr(). The wrapper
		// attributes and the data-wp-context attribute arrive pre-built by WordPress
		// and stay as-is, as do the composed child-view markups above. `mode_label`
		// and `speed_label` appear in both a text slot and an aria-label, so each
		// also gets an attribute-escaped variant.
		$mode_label_attr     = esc_attr( $mode_label );
		$speed_label_attr    = esc_attr( $speed_label );
		$brand_title         = esc_html( $brand_title );
		$brand_subtitle      = esc_html( $brand_subtitle );
		$mode_label          = esc_html( $mode_label );
		$duration_mode       = esc_html( $duration_mode );
		$target_drop_mode    = esc_html( $target_drop_mode );
		$duration_label      = esc_html( $duration_label );
		$minutes_label       = esc_html( $minutes_label );
		$decrease_label      = esc_attr( $decrease_label );
		$increase_label      = esc_attr( $increase_label );
		$target_label        = esc_html( $target_label );
		$target_aria         = esc_attr( $target_aria );
		$speed_label         = esc_html( $speed_label );
		$battery_label       = esc_html( $battery_label );
		$rate10_label        = esc_html( $rate10_label );
		$rate_session_label  = esc_html( $rate_session_label );
		$tte_label           = esc_html( $tte_label );
		$target_short_label  = esc_html( $target_short_label );
		$surfing_label       = esc_html( $surfing_label );
		$sterile_label       = esc_html( $sterile_label );
		$elapsed_label       = esc_html( $elapsed_label );
		$remaining_label     = esc_html( $remaining_label );
		$start_label         = esc_html( $start_label );
		$stop_label          = esc_html( $stop_label );
		$plugged_label       = esc_html( $plugged_label );
		$compact_label       = esc_attr( $compact_label );
		$expand_label        = esc_attr( $expand_label );
		$sound_label         = esc_attr( $sound_label );
		$viewport_title      = esc_attr( $viewport_title );
		$toast_dismiss_label = esc_attr( $toast_dismiss_label );
		$idle_heading        = esc_html( $idle_heading );
		$idle_subtitle       = esc_html( $idle_subtitle );
		$idle_step1_title    = esc_html( $idle_step1_title );
		$idle_step1_text     = esc_html( $idle_step1_text );
		$idle_step2_title    = esc_html( $idle_step2_title );
		$idle_step2_text     = esc_html( $idle_step2_text );
		$idle_step3_title    = esc_html( $idle_step3_title );
		$idle_step3_text     = esc_html( $idle_step3_text );
		$idle_notice_title   = esc_html( $idle_notice_title );
		$idle_notice_text    = esc_html( $idle_notice_text );
		$unsupported_head    = esc_html( $unsupported_head );
		$unsupported_sub     = esc_html( $unsupported_sub );
		$unsupported_lead    = esc_html( $unsupported_lead );
		$unsupported_body    = esc_html( $unsupported_body );
		$unsupported_browse  = esc_html( $unsupported_browse );
		$new_run_label       = esc_html( $new_run_label );

		// Each duration-odometer wheel is a strip of 0–9 repeated three times; the
		// client store (rollDuration) slides it to roll the digit. Built here so
		// the wheel markup stays a single repeated unit owned by the view.
		$bsb_digit_cells = <<<'CELLS'
<span class="bsb-odometer__cell">0</span><span class="bsb-odometer__cell">1</span><span class="bsb-odometer__cell">2</span><span class="bsb-odometer__cell">3</span><span class="bsb-odometer__cell">4</span><span class="bsb-odometer__cell">5</span><span class="bsb-odometer__cell">6</span><span class="bsb-odometer__cell">7</span><span class="bsb-odometer__cell">8</span><span class="bsb-odometer__cell">9</span>
CELLS;
		$odometer_cells  = str_repeat( $bsb_digit_cells, 3 );

		// The live readouts, split so the same bindings render in two places: the
		// deck's vertical pill (normal) and the stage's horizontal top pill
		// (compact). The status line ("surfing · elapsed") is broken out from the
		// metrics + parallax waves so the compact bar can pair it with the project
		// wordmark in a left-hand lockup, while the deck pill stacks them as before.
		// Both bind to the same store getters, so the readings stay in lock-step.
		// The waves also carry the Konami-code shark fin's lane, sandwiched
		// between the mid and front wave layers so the front foam sheet occludes
		// the fin's waterline by DOM order alone (absolute siblings stack by
		// source position) — no z-index is added to the wave structure. The fin
		// is only ever visible while this same pill renders as the compact
		// topbar, since that is the only state the Easter egg arms in. The
		// fin's gradient fill is defined inline in its own SVG (`bsb-fin-grad`)
		// rather than in the stylesheet, since SVG gradients aren't settable
		// from CSS; because this same pill body renders twice (deck pill +
		// compact topbar), that id appears twice in the document too — `url(#…)`
		// resolves to the first match, so both fins reference one definition,
		// which is exactly the intent. The target browsers (the Chromium
		// family — the only ones exposing the Battery Status API this cockpit
		// depends on) resolve a gradient reference out of a `display: none`
		// subtree fine.
		$status_head = <<<HEAD
<div class="bsb-deck__status-head">
				<span class="bsb-deck__status-mark" aria-hidden="true" data-wp-class--is-sterile="state.isSterileRun" data-wp-style----bsb-wave-speed="context.speed"></span>
				<span class="bsb-deck__status-text">{$surfing_label} &middot; <span class="bsb-deck__clock" data-wp-text="state.runClock"></span> <span data-wp-bind--hidden="state.isModeDuration">{$elapsed_label}</span><span data-wp-bind--hidden="state.isModeTargetDrop">{$remaining_label}</span><span class="bsb-deck__sterile-chip" hidden data-wp-bind--hidden="!state.isSterileRun">{$sterile_label}</span></span>
			</div>
HEAD;

		$pill_body = <<<BODY
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
BODY;

		// The startup flip postcard: its picture front greets the visitor with the
		// deck tucked away; flipping it (actions.toggleIdleFlip) turns to the written
		// back. The back carries two sides toggled by the Battery Status API check:
		// the "how this run works" guide (the deck slides in behind it) and, where
		// the API is unsupported, a warning that locks the cockpit (the deck stays
		// away). The guide ships visible and the warning hidden; the client swaps
		// them on hydration only where the API is missing, so a supported browser
		// never sees the warning and there is no flash.
		$idle_back = <<<HTML
<div class="bsb-cockpit__postcard-side bsb-cockpit__postcard-side--guide" data-wp-bind--hidden="state.isBatteryUnsupported">
			{$frank_blank}
			<div class="bsb-cockpit__postcard-note">
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
		<div class="bsb-cockpit__postcard-side bsb-cockpit__postcard-side--warning" hidden data-wp-bind--hidden="!state.isBatteryUnsupported">
			{$frank_warning}
			<div class="bsb-cockpit__postcard-note bsb-cockpit__postcard-note--warning">
				<h2 class="bsb-cockpit__postcard-heading">{$unsupported_head}</h2>
				<p class="bsb-cockpit__postcard-subtitle">{$unsupported_sub}</p>
				<span class="bsb-cockpit__postcard-divide" aria-hidden="true"></span>
				<p class="bsb-cockpit__postcard-body"><b>{$unsupported_lead}</b>{$unsupported_body}</p>
				<p class="bsb-cockpit__postcard-browsers"><span class="bsb-cockpit__postcard-globe" aria-hidden="true"></span>{$unsupported_browse}</p>
			</div>
		</div>
HTML;
		$idle_card = ( new FlipPostcard() )->render(
			array(
				'front'       => $photo_fill,
				'back'        => $idle_back,
				'flip_label'  => $data['flip_label'] ?? '',
				'flip_action' => 'actions.toggleIdleFlip',
				'flip_state'  => 'state.isIdleFlipped',
				'modifier'    => 'bsb-flipcard--idle',
			)
		);

		// The run-summary flip card, on its shared shell: a franked (cancelled)
		// stamp and the run report on the back, raised by the `.bsb-summary`
		// overlay. The same view renders the stored-session detail page's card, so
		// the two stay identical; here it ships `hidden` (the store raises it on
		// run end) with the live "New run" button placed beside the flip badge in
		// the shared card corner, rather than as a footer.
		$summary = ( new SummaryCard() )->render(
			array(
				'front'              => $photo_fill,
				'frank'              => $frank,
				'back_actions'       => sprintf(
					'<button type="button" class="bsb-summary__newrun" data-wp-on--click="actions.newRun"><span class="bsb-summary__newrun-icon" aria-hidden="true"></span>%s</button>',
					$new_run_label
				),
				'flip_label'         => $data['flip_label'] ?? '',
				'tte_label'          => $data['tte_label'] ?? '',
				'rate_session_label' => $data['rate_session_label'] ?? '',
				'rate10_label'       => $data['rate10_label'] ?? '',
				'battery_label'      => $data['battery_label'] ?? '',
				'dropped_label'      => $data['dropped_label'] ?? '',
				'pts_label'          => $data['pts_label'] ?? '',
				'elapsed_run_label'  => $data['elapsed_run_label'] ?? '',
				'measured_label'     => $data['measured_label'] ?? '',
				'projected_label'    => $data['projected_label'] ?? '',
				'start_hidden'       => true,
			)
		);

		// The surfer-profile field: class-preset chips, a Customize disclosure and
		// the six point-buy stat sliders. The trait vector is the single source on
		// the root context, so each chip/slider carries a plain `data-class` /
		// `data-index` the actions read (the runtime copies nested contexts, so a
		// nested vector would desync). The per-element readouts bind to fixed store
		// getters generated per class and per stat index (see TraitsStore): a chip's
		// active state to `state.isClass<Key>`, a slider's value/track to
		// `state.traitValue<i>` / `state.traitTrack<i>`.
		$bsb_chips = '';
		foreach ( $trait_classes as $bsb_class ) {
			$bsb_chip_key   = isset( $bsb_class['key'] ) ? (string) $bsb_class['key'] : '';
			$bsb_chip_attr  = esc_attr( $bsb_chip_key );
			$bsb_chip_state = esc_attr( 'state.isClass' . preg_replace( '/[^a-zA-Z0-9]/', '', $bsb_chip_key ) );
			$bsb_chip_text  = esc_html( isset( $bsb_class['label'] ) ? (string) $bsb_class['label'] : '' );
			$bsb_chips     .= <<<CHIP
<button type="button" class="bsb-chip" data-class="{$bsb_chip_attr}" data-wp-on--click="actions.selectClass" data-wp-bind--aria-pressed="{$bsb_chip_state}" data-wp-class--is-active="{$bsb_chip_state}">{$bsb_chip_text}</button>
CHIP;
		}

		$bsb_stat_rows = '';
		foreach ( $trait_stats as $bsb_index => $bsb_stat ) {
			$bsb_stat_i     = (int) $bsb_index;
			$bsb_stat_name  = esc_html( isset( $bsb_stat['name'] ) ? (string) $bsb_stat['name'] : '' );
			$bsb_stat_lever = esc_html( isset( $bsb_stat['lever'] ) ? (string) $bsb_stat['lever'] : '' );
			$bsb_stat_aria  = esc_attr( isset( $bsb_stat['name'] ) ? (string) $bsb_stat['name'] : '' );
			$bsb_stat_rows .= <<<ROW
<div class="bsb-stat">
						<div class="bsb-stat__top"><span class="bsb-stat__name">{$bsb_stat_name}</span><span class="bsb-stat__val" data-wp-text="state.traitValue{$bsb_stat_i}"></span></div>
						<span class="bsb-stat__lever">{$bsb_stat_lever}</span>
						<input class="bsb-stat__slider" type="range" min="0" max="10" step="1" data-index="{$bsb_stat_i}" aria-label="{$bsb_stat_aria}" data-wp-bind--value="state.traitValue{$bsb_stat_i}" data-wp-style--background="state.traitTrack{$bsb_stat_i}" data-wp-on--input="actions.setTrait" />
					</div>
ROW;
		}

		$surfer_label    = esc_html( $surfer_label );
		$customize_label = esc_html( $customize_label );
		$reset_label     = esc_html( $reset_label );
		$points_label    = esc_html( $points_label );

		$bsb_surfer_field = <<<HTML
<section class="bsb-field bsb-field--surfer">
					<span class="bsb-field__label">{$surfer_label} <span class="bsb-surfer__build" data-wp-text="state.archetypeLabel"></span></span>
					<div class="bsb-chips">{$bsb_chips}</div>
					<button type="button" class="bsb-surfer__customize" data-wp-on--click="actions.toggleCustomize" data-wp-bind--aria-expanded="state.isCustomizeOpen" data-wp-class--is-open="state.isCustomizeOpen">{$customize_label}</button>
					<div class="bsb-surfer__stats" data-wp-class--is-open="state.isCustomizeOpen">
						<div class="bsb-surfer__pool" data-wp-class--is-empty="state.isBudgetEmpty">
							<span class="bsb-surfer__points" data-wp-text="state.pointsLeftDisplay"></span>
							<span class="bsb-surfer__points-label">{$points_label}</span>
							<button type="button" class="bsb-surfer__reset" data-wp-on--click="actions.resetTraits">{$reset_label}</button>
						</div>
						{$bsb_stat_rows}
					</div>
				</section>
HTML;

		return <<<HTML
<div {$wrapper} data-wp-interactive="bsb/cockpit" {$context} data-wp-init---battery="callbacks.initBattery" data-wp-init---wake-lock="callbacks.initWakeLock" data-wp-init---sound="callbacks.initSound" data-wp-init---page-advance="callbacks.initPageAdvance" data-wp-init---exit-guard="callbacks.initExitGuard" data-wp-init---bark="callbacks.initBark" data-wp-init---shark="callbacks.initShark" data-wp-watch---run-activity="callbacks.syncRunActivity" data-wp-watch---viewport-watchdog="callbacks.syncViewportWatchdog" data-wp-watch---devtools-battery="callbacks.syncBatteryOverride" data-wp-watch---devtools-surf="callbacks.syncDevtoolsSurf" data-wp-watch---shark-compact="callbacks.syncSharkCompact" data-wp-watch---devtools-shark="callbacks.syncDevtoolsShark" data-wp-class--is-compact="state.isCompact" data-wp-class--is-deck-shown="state.isDeckShown">
	<aside class="bsb-cockpit__deck">
		<header class="bsb-deck__brand">
			<span class="bsb-deck__mark" aria-hidden="true"></span>
			<span class="bsb-deck__title">{$brand_title}</span>
			<span class="bsb-deck__subtitle">{$brand_subtitle}</span>
			<span class="bsb-deck__actions">
				<button type="button" class="bsb-deck__compact" data-wp-on--click="actions.toggleCompact" data-wp-class--is-hidden="state.isIdle" aria-label="{$compact_label}"></button>
				<button type="button" class="bsb-deck__sound" data-wp-on--click="actions.toggleSound" data-wp-class--is-on="state.isSoundOn" data-wp-bind--aria-pressed="state.isSoundOn" aria-label="{$sound_label}"></button>
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

			{$bsb_surfer_field}

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
			{$status_head}
			{$pill_body}
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
				<div class="bsb-cockpit__lockup">
					<span class="bsb-cockpit__brandmark">{$brand_title}</span>
				{$status_head}
				</div>
			{$pill_body}
				<div class="bsb-deck__readout-ctrl">
					<button type="button" class="bsb-deck__readout-stop" data-wp-on--click="actions.toggleRun">{$stop_label}</button>
					<button type="button" class="bsb-deck__expand" data-wp-on--click="actions.toggleCompact" aria-label="{$expand_label}"></button>
					<button type="button" class="bsb-deck__readout-sound" data-wp-on--click="actions.toggleSound" data-wp-class--is-on="state.isSoundOn" data-wp-bind--aria-pressed="state.isSoundOn" aria-label="{$sound_label}"></button>
				</div>
			</div>
		</div>
		<div class="bsb-cockpit__idle" data-wp-bind--hidden="state.isRunning">
			{$idle_card}
		</div>
		<div class="bsb-cockpit__viewport-wrap" hidden data-wp-bind--hidden="state.isIdle" data-wp-on--pointerenter="actions.viewportEnter">
			<iframe class="bsb-cockpit__viewport" title="{$viewport_title}" data-wp-bind--src="state.currentSrc" data-wp-on--load="actions.guardViewport" data-wp-on--error="actions.guardViewport"></iframe>
			<div class="bsb-cockpit__bark-layer" aria-hidden="true">
				<div class="bsb-cockpit__bark" hidden data-wp-bind--hidden="!state.hasBark" data-wp-bind--data-bark="state.barkKey" data-wp-class--is-entering="state.isBarkEntering" data-wp-class--is-leaving="state.isBarkLeaving">
					<span class="bsb-cockpit__bark-tide" aria-hidden="true" data-wp-style----bark-dur="state.barkDurationCss" data-wp-style----bark-ebb-name="state.barkEbbName" data-wp-style----bsb-wave-speed="context.speed">
						<span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--back" aria-hidden="true"></span>
						<span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--mid" aria-hidden="true"></span>
						<span class="bsb-cockpit__bark-tide-wave bsb-cockpit__bark-tide-wave--front" aria-hidden="true"></span>
					</span>
					<span class="bsb-cockpit__bark-icon" aria-hidden="true"></span>
					<span class="bsb-cockpit__bark-msg" data-wp-text="state.barkMessage"></span>
				</div>
			</div>
			<div class="bsb-cockpit__shield" aria-hidden="true"></div>
		</div>
	</div>

	{$summary}

	<div class="bsb-cockpit__toast-layer">
		<div class="bsb-cockpit__toast" hidden role="status" data-wp-bind--hidden="!state.hasToast" data-wp-bind--role="state.toastRole" data-wp-class--is-error="state.isToastError" data-wp-class--is-notice="state.isToastNotice" data-wp-class--is-entering="state.isToastEntering" data-wp-class--is-holding="state.isToastHolding" data-wp-class--is-leaving="state.isToastLeaving" data-wp-on--animationend="callbacks.onToastAnimationEnd">
			<span class="bsb-cockpit__toast-icon" aria-hidden="true"></span>
			<span class="bsb-cockpit__toast-msg" data-wp-text="state.toastMessage"></span>
			<button type="button" class="bsb-cockpit__toast-close" data-wp-on--click="actions.dismissToast" aria-label="{$toast_dismiss_label}"></button>
		</div>
	</div>
</div>
HTML;
	}
}
