<?php
/**
 * Cockpit block view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

use function preg_replace;
use function str_repeat;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the `battery-surf-bench/cockpit` block's front-end markup: the Interactivity-driven
 * region split into a control deck and a surf stage. The deck carries the run
 * controls — mode, duration, speed and a start/stop
 * control — each wired to the client store ({@see src/cockpit/view.ts}). While a
 * run is live the configuration controls give way to the live readouts pill; the
 * stage carries the viewport iframe. The block's server render
 * template ({@see src/cockpit/render.php}) prepares the dynamic, raw (translated)
 * values — wrapper attributes, the per-instance `data-wp-context`, and the
 * translated labels — and hands them here; this view owns the structure and the
 * escaping, held in its templates, so no HTML is written or escaped inline in the
 * render template.
 */
class CockpitView implements View {

	/**
	 * Renders the cockpit block markup.
	 *
	 * @param array<string, mixed> $data {
	 *     Raw (translated) values from the block render template; its templates escape
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
		// first — each child view escapes what it is handed — and the templates
		// escape the same values for their own slots. The photo fills a flip
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

		// Each duration-odometer wheel is a strip of 0–9 repeated three times; the
		// client store (rollDuration) slides it to roll the digit. Built here so
		// the wheel markup stays a single repeated unit owned by the view.
		$odometer_cells = str_repeat( Template::render( __DIR__ . '/Templates/CockpitDigitCells.php' ), 3 );

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
		$status_head = Template::render(
			__DIR__ . '/Templates/CockpitStatusHead.php',
			array(
				'surfing_label'   => $surfing_label,
				'elapsed_label'   => $elapsed_label,
				'remaining_label' => $remaining_label,
				'sterile_label'   => $sterile_label,
			)
		);

		$pill_body = Template::render(
			__DIR__ . '/Templates/CockpitPillBody.php',
			array(
				'battery_label'      => $battery_label,
				'target_short_label' => $target_short_label,
				'tte_label'          => $tte_label,
				'rate10_label'       => $rate10_label,
				'rate_session_label' => $rate_session_label,
			)
		);

		// The startup flip postcard: its picture front greets the visitor with the
		// deck tucked away; flipping it (actions.toggleIdleFlip) turns to the written
		// back. The back carries two sides toggled by the Battery Status API check:
		// the "how this run works" guide (the deck slides in behind it) and, where
		// the API is unsupported, a warning that locks the cockpit (the deck stays
		// away). The guide ships visible and the warning hidden; the client swaps
		// them on hydration only where the API is missing, so a supported browser
		// never sees the warning and there is no flash.
		$idle_back = Template::render(
			__DIR__ . '/Templates/CockpitIdleBack.php',
			array(
				'frank_blank'        => $frank_blank,
				'idle_heading'       => $idle_heading,
				'idle_subtitle'      => $idle_subtitle,
				'idle_step1_title'   => $idle_step1_title,
				'idle_step1_text'    => $idle_step1_text,
				'idle_step2_title'   => $idle_step2_title,
				'idle_step2_text'    => $idle_step2_text,
				'idle_step3_title'   => $idle_step3_title,
				'idle_step3_text'    => $idle_step3_text,
				'idle_notice_title'  => $idle_notice_title,
				'idle_notice_text'   => $idle_notice_text,
				'frank_warning'      => $frank_warning,
				'unsupported_head'   => $unsupported_head,
				'unsupported_sub'    => $unsupported_sub,
				'unsupported_lead'   => $unsupported_lead,
				'unsupported_body'   => $unsupported_body,
				'unsupported_browse' => $unsupported_browse,
			)
		);
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
				'back_actions'       => Template::render(
					__DIR__ . '/Templates/CockpitNewRunButton.php',
					array( 'new_run_label' => $new_run_label )
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
			$bsb_chip_key = isset( $bsb_class['key'] ) ? (string) $bsb_class['key'] : '';
			$bsb_chips   .= Template::render(
				__DIR__ . '/Templates/CockpitChip.php',
				array(
					'chip_attr'  => $bsb_chip_key,
					'chip_state' => 'state.isClass' . preg_replace( '/[^a-zA-Z0-9]/', '', $bsb_chip_key ),
					'chip_text'  => isset( $bsb_class['label'] ) ? (string) $bsb_class['label'] : '',
				)
			);
		}

		$bsb_stat_rows = '';
		foreach ( $trait_stats as $bsb_index => $bsb_stat ) {
			$bsb_stat_rows .= Template::render(
				__DIR__ . '/Templates/CockpitStatRow.php',
				array(
					'stat_name'  => isset( $bsb_stat['name'] ) ? (string) $bsb_stat['name'] : '',
					'stat_i'     => $bsb_index,
					'stat_lever' => isset( $bsb_stat['lever'] ) ? (string) $bsb_stat['lever'] : '',
					'stat_aria'  => isset( $bsb_stat['name'] ) ? (string) $bsb_stat['name'] : '',
				)
			);
		}

		$bsb_surfer_field = Template::render(
			__DIR__ . '/Templates/CockpitSurferField.php',
			array(
				'surfer_label'    => $surfer_label,
				'chips'           => $bsb_chips,
				'customize_label' => $customize_label,
				'points_label'    => $points_label,
				'reset_label'     => $reset_label,
				'stat_rows'       => $bsb_stat_rows,
			)
		);

		return Template::render(
			__DIR__ . '/Templates/Cockpit.php',
			array(
				'wrapper'             => $wrapper,
				'context'             => $context,
				'brand_title'         => $brand_title,
				'brand_subtitle'      => $brand_subtitle,
				'compact_label'       => $compact_label,
				'sound_label'         => $sound_label,
				'mode_label'          => $mode_label,
				'duration_mode'       => $duration_mode,
				'target_drop_mode'    => $target_drop_mode,
				'duration_label'      => $duration_label,
				'decrease_label'      => $decrease_label,
				'odometer_cells'      => $odometer_cells,
				'minutes_label'       => $minutes_label,
				'increase_label'      => $increase_label,
				'target_label'        => $target_label,
				'target_aria'         => $target_aria,
				'surfer_field'        => $bsb_surfer_field,
				'speed_label'         => $speed_label,
				'status_head'         => $status_head,
				'pill_body'           => $pill_body,
				'start_label'         => $start_label,
				'stop_label'          => $stop_label,
				'plugged_label'       => $plugged_label,
				'expand_label'        => $expand_label,
				'idle_card'           => $idle_card,
				'viewport_title'      => $viewport_title,
				'summary'             => $summary,
				'toast_dismiss_label' => $toast_dismiss_label,
			)
		);
	}
}
