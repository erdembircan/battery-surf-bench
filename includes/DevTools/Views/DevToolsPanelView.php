<?php
/**
 * Dev-tools panel view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\DevTools\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

use function array_map;
use function wp_json_encode;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the floating dev-tools widget: a collapsed "DEV" pill that swaps —
 * mutually exclusive, never both on screen — into a coastal field card with
 * one bounded sub-panel per tool: Battery (the override), Discharge (the
 * simulation that drives it) and Surf (the sterile-run behavior steerer). A
 * fourth tool is another group in the card body, not a rework.
 *
 * The battery group has no enable switch: every control already carries its
 * own explicit off-state (the charging tri-state's "System" choice, the
 * level row's "System" button), so there is nothing left for a master switch
 * to gate — a control is either following the system or overriding it, with
 * no third "armed but nothing set" state in between.
 *
 * The discharge group is purely a driver of the battery group's own level
 * override — it has no seam of its own. While it is running, every other
 * battery-related control (the charging tri-state, the level row, and the
 * sim's own steppers) is disabled; only Stop stays live. This muting is
 * legitimate — gated by a genuinely running process — unlike the removed
 * enable switches, which gated nothing real. The discharge group's own head
 * additionally carries a countdown (`MM:SS` remaining), right-aligned beside
 * its "Discharge" title, shown only while the sim is running.
 *
 * The surf group arms the "Sterile" run override (a Natural/Sterile seg,
 * selecting in coral — an armed override, not a product mode; the seg speaks
 * for itself, with no hint line underneath it). Sterile is snapshotted at
 * run start only, so toggling the seg mid-run would do nothing to an
 * already-live run: both seg options are disabled for the duration of ANY
 * live run, natural or sterile, mirroring `state.devtoolsSurfModeDisabled`.
 * A course-page stepper (prev/next arrows around a mono readout of the live
 * course page's own real slug — this manager is environment-gated, so it may
 * safely hand the panel an identifier a production surface never leaks) and
 * one chip per behavior, in engine boot order, each carrying its own
 * `data-devtools-behavior` key as its visible text (a developer identifier,
 * deliberately NOT translated), round out the group. The group's own head
 * carries the same right-aligned countdown pattern as Discharge, showing
 * which behavior is currently steered and its remaining dwell.
 *
 * The card header divides into exactly three zones: the title (the eyebrow),
 * the override status (the armed indicator), and a panel-buttons container
 * (`.bsb-devtools__card-actions`) holding Reset, then Shark, then Close —
 * Reset's visibility is dynamic (it only appears once an override is armed),
 * so it keeps the cluster's outer edge and the two always-present controls
 * hold their ground beside it. Shark releases the cockpit's dorsal-fin Easter
 * egg on demand — an icon-only control like its neighbours, enabled only
 * while a shark could actually surface (a run live, the topbar compact: the
 * same window the Konami code arms in), which the cockpit mirrors onto the
 * shared slice for the button's disabled binding to read. Reset is the
 * panel's one cross-cutting escape hatch — it clears every override at once,
 * including stopping a running sim and disarming the sterile override —
 * rendered as an icon-only control (its accessible name lives in
 * `aria-label`, matching Close) and stays enabled the whole time: unlike the
 * battery group's own controls, it is never disabled while a sim runs, since
 * stopping the sim is exactly what it is there to do.
 *
 * The panel sits outside the `bsb/cockpit` block, so it carries its own
 * `data-wp-interactive="bsb/cockpit"` region but has no cockpit context — every
 * binding below reads shared `state` (never a `getContext()`-derived getter),
 * and every member it reads or writes carries the `devtools` prefix so it can
 * never collide with a production store member. It is rendered here from its
 * templates, then printed as trusted markup by the cockpit dashboard, which
 * places it via the `battery_surf_bench_devtools_panel` filter.
 */
class DevToolsPanelView implements View {

	/**
	 * Renders the panel body.
	 *
	 * @param array<string, mixed> $data {
	 *     Raw (translated) labels.
	 *
	 *     @type string $dev_label              Raw label on the collapsed pill.
	 *     @type string $eyebrow_label           Raw card header eyebrow.
	 *     @type string $armed_label             Raw "override active" header text.
	 *     @type string $reset_label             Raw accessible label for the panel-wide reset control.
	 *     @type string $close_label             Raw accessible label for the close control.
	 *     @type string $shark_label             Raw accessible label for the shark-release control.
	 *     @type string $battery_label           Raw battery group heading.
	 *     @type string $charging_group_label    Raw accessible group label for the charging tri-state.
	 *     @type string $system_label            Raw label for the "follow system" choice, reused by both the charging tri-state and the level row.
	 *     @type string $charging_label          Raw label for the "force charging" choice.
	 *     @type string $discharging_label       Raw label for the "force discharging" choice.
	 *     @type string $level_label             Raw accessible label for the level-override slider.
	 *     @type string $discharge_label         Raw discharge group heading.
	 *     @type string $from_label              Raw label for the start-percentage stepper.
	 *     @type string $from_decrease_label     Raw accessible label for decreasing the start percentage.
	 *     @type string $from_increase_label     Raw accessible label for increasing the start percentage.
	 *     @type string $to_label                Raw label for the end-percentage stepper.
	 *     @type string $to_decrease_label       Raw accessible label for decreasing the end percentage.
	 *     @type string $to_increase_label        Raw accessible label for increasing the end percentage.
	 *     @type string $duration_label          Raw label for the duration stepper.
	 *     @type string $duration_decrease_label Raw accessible label for decreasing the duration.
	 *     @type string $duration_increase_label Raw accessible label for increasing the duration.
	 *     @type string $percent_unit_label      Raw unit label for the From/To steppers.
	 *     @type string $minutes_unit_label      Raw unit label for the duration stepper.
	 *     @type string              $start_label            Raw label for the sim's Start state.
	 *     @type string              $stop_label             Raw label for the sim's Stop state.
	 *     @type string              $surf_label             Raw Surf group heading.
	 *     @type string              $natural_label          Raw label for the Natural seg option.
	 *     @type string              $sterile_label          Raw label for the Sterile seg option.
	 *     @type string              $auction_override_label Raw accessible group label for the Natural/Sterile seg.
	 *     @type string              $page_label             Raw label for the page stepper row.
	 *     @type string              $page_prev_label        Raw accessible label for the previous-page button.
	 *     @type string              $page_next_label        Raw accessible label for the next-page button.
	 *     @type array<int, string>  $behavior_keys          The nine behaviors' developer-identifier keys, in engine boot order — rendered verbatim as each chip's visible text, never translated.
	 *     @type array<int, string>  $course_slugs           The saved surf-course order's slugs, in visit order — never translated; emitted as a JSON data attribute for the client to index by the opaque page position.
	 * }
	 * @return string The panel markup.
	 */
	public function render( array $data = array() ): string {
		$behavior_keys = isset( $data['behavior_keys'] ) && is_array( $data['behavior_keys'] ) ? $data['behavior_keys'] : array();
		$course_slugs  = isset( $data['course_slugs'] ) && is_array( $data['course_slugs'] ) ? $data['course_slugs'] : array();

		// The ordered course-page slugs, as a JSON data attribute the client
		// parses in devtoolsInitSurf() — developer identifiers, not translated
		// text, so this is a plain JSON encode, never __(); the template escapes it
		// into the attribute. A failed encode (should not happen for a plain string
		// list) falls back to an empty array rather than emitting `false` into the
		// attribute.
		$encoded_course_slugs = wp_json_encode( array_map( 'strval', $course_slugs ) );
		$course_slugs_json    = false === $encoded_course_slugs ? '[]' : $encoded_course_slugs;

		// One chip per behavior, in the engine's own boot order. Each key is a
		// developer identifier — rendered verbatim as the chip's visible text,
		// never translated — so the template escapes it for HTML/attribute safety
		// only, not passed through `__()`. `moveOn` additionally carries the
		// caution modifier class: it navigates the course, everything else stays on
		// the page.
		$bsb_surf_chips = '';
		foreach ( $behavior_keys as $bsb_behavior_key ) {
			$bsb_surf_chips .= Template::render(
				__DIR__ . '/Templates/DevToolsPanelSurfChip.php',
				array(
					'chip_class' => 'bsb-devtools__chip' . ( 'moveOn' === $bsb_behavior_key ? ' bsb-devtools__chip--caution' : '' ),
					'key_attr'   => (string) $bsb_behavior_key,
					'key_html'   => (string) $bsb_behavior_key,
				)
			);
		}

		return Template::render(
			__DIR__ . '/Templates/DevToolsPanel.php',
			array(
				'dev'               => (string) ( $data['dev_label'] ?? '' ),
				'eyebrow'           => (string) ( $data['eyebrow_label'] ?? '' ),
				'armed'             => (string) ( $data['armed_label'] ?? '' ),
				'reset'             => (string) ( $data['reset_label'] ?? '' ),
				'close'             => (string) ( $data['close_label'] ?? '' ),
				'shark'             => (string) ( $data['shark_label'] ?? '' ),
				'battery'           => (string) ( $data['battery_label'] ?? '' ),
				'charging_group'    => (string) ( $data['charging_group_label'] ?? '' ),
				'system'            => (string) ( $data['system_label'] ?? '' ),
				'charging_choice'   => (string) ( $data['charging_label'] ?? '' ),
				'discharging'       => (string) ( $data['discharging_label'] ?? '' ),
				'level'             => (string) ( $data['level_label'] ?? '' ),
				'discharge'         => (string) ( $data['discharge_label'] ?? '' ),
				'from'              => (string) ( $data['from_label'] ?? '' ),
				'from_decrease'     => (string) ( $data['from_decrease_label'] ?? '' ),
				'from_increase'     => (string) ( $data['from_increase_label'] ?? '' ),
				'to'                => (string) ( $data['to_label'] ?? '' ),
				'to_decrease'       => (string) ( $data['to_decrease_label'] ?? '' ),
				'to_increase'       => (string) ( $data['to_increase_label'] ?? '' ),
				'duration'          => (string) ( $data['duration_label'] ?? '' ),
				'duration_decrease' => (string) ( $data['duration_decrease_label'] ?? '' ),
				'duration_increase' => (string) ( $data['duration_increase_label'] ?? '' ),
				'percent_unit'      => (string) ( $data['percent_unit_label'] ?? '' ),
				'minutes_unit'      => (string) ( $data['minutes_unit_label'] ?? '' ),
				'start'             => (string) ( $data['start_label'] ?? '' ),
				'stop'              => (string) ( $data['stop_label'] ?? '' ),
				'surf'              => (string) ( $data['surf_label'] ?? '' ),
				'natural'           => (string) ( $data['natural_label'] ?? '' ),
				'sterile'           => (string) ( $data['sterile_label'] ?? '' ),
				'auction_override'  => (string) ( $data['auction_override_label'] ?? '' ),
				'page'              => (string) ( $data['page_label'] ?? '' ),
				'page_prev'         => (string) ( $data['page_prev_label'] ?? '' ),
				'page_next'         => (string) ( $data['page_next_label'] ?? '' ),
				'course_slugs_json' => $course_slugs_json,
				'surf_chips'        => $bsb_surf_chips,
			)
		);
	}
}
