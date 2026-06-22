<?php
/**
 * Server render for the `bsb/cockpit` block.
 *
 * The `pages` attribute is resolved by the `bsb/course-pages` Block Bindings
 * source before this template runs: a list of `{ slug, title, url }` the
 * cockpit can surf. The cockpit decides which page to show — for now the first
 * in the list — and the Interactivity API keeps the iframe pointed at it, so
 * the choice can move client-side as configuration controls are added.
 *
 * This template only prepares the dynamic, raw (translated) values; the markup
 * itself lives in {@see CockpitView}, which escapes each value and owns the HTML,
 * so nothing is escaped or written inline here.
 *
 * @var array    $attributes Block attributes; `pages` holds the bound course list.
 * @var string   $content    Inner block markup (unused; the cockpit has none yet).
 * @var WP_Block $block      The block instance.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView;

use function __;
use function get_block_wrapper_attributes;
use function wp_interactivity_data_wp_context;

defined( 'ABSPATH' ) || exit;

$bsb_pages = isset( $attributes['pages'] ) && is_array( $attributes['pages'] ) ? $attributes['pages'] : array();

// Per-instance Interactivity context: the surfable pages, which one is active,
// and the run configuration the control deck edits. The active page's URL is
// derived from these on the client (see view.ts) and bound onto the iframe, so
// changing the index later re-points the viewport with no reload of the cockpit
// itself; the deck reads and writes the run fields through the same store.
$bsb_context = array(
	'pages'               => $bsb_pages,
	'activeIndex'         => 0,
	'mode'                => 'duration',
	'durationMinutes'     => 30,
	'baseline'            => false,
	'speed'               => 1,
	'running'             => false,
	'compact'             => false,
	// Seeded on; the client restores the remembered choice from localStorage on
	// hydration, since the server cannot know a client-side preference.
	'soundEnabled'        => true,
	'elapsed'             => 0,
	// Seeded at the nominal max; the client caps it down to the current battery
	// level on the first reading, so the slider defaults to "as much as you have".
	'targetPercent'       => 95,
	'batteryLevel'        => null,
	'batteryCharging'     => false,
	'rate10'              => null,
	'rateSession'         => null,
	'secondsToEmpty'      => null,
	// The run-summary state machine: a run has not ended yet, with no reason and
	// the card on its picture front. Set when a run stops (whatever the cause).
	'ended'               => false,
	'endReason'           => '',
	'flipped'             => false,
	// Summary readouts, frozen onto the context at run end (kept reactive so the
	// summary renders); empty until a run finishes.
	'summaryBatteryStart' => '',
	'summaryBatteryEnd'   => '',
	'summaryDropped'      => '',
	'hasGraph'            => false,
	// Serialised drain-graph draw model; the summary painter parses it to draw.
	'graphJson'           => '',
	// Translated summary wording, indexed by end reason; the store picks the set
	// matching how the run ended (kept here so the strings stay translatable).
	'reasonText'          => array(
		'duration'   => array(
			'head' => __( 'The run is in.', 'battery-surf-bench' ),
			'sig'  => __( 'Ran the full duration.', 'battery-surf-bench' ),
			'arc'  => __( '· COMPLETED ·', 'battery-surf-bench' ),
			'unit' => __( 'run', 'battery-surf-bench' ),
		),
		'targetDrop' => array(
			'head' => __( 'Target reached.', 'battery-surf-bench' ),
			'sig'  => __( 'The battery hit your mark.', 'battery-surf-bench' ),
			'arc'  => __( '· TARGET MET ·', 'battery-surf-bench' ),
			'unit' => __( 'reached', 'battery-surf-bench' ),
		),
		'stopped'    => array(
			'head' => __( 'Called it early.', 'battery-surf-bench' ),
			'sig'  => __( 'You stopped the run.', 'battery-surf-bench' ),
			'arc'  => __( '· STOPPED ·', 'battery-surf-bench' ),
			'unit' => __( 'elapsed', 'battery-surf-bench' ),
		),
		'plugged'    => array(
			'head' => __( 'Plugged back in.', 'battery-surf-bench' ),
			'sig'  => __( 'The charger ended the run.', 'battery-surf-bench' ),
			'arc'  => __( '· INTERRUPTED ·', 'battery-surf-bench' ),
			'unit' => __( 'elapsed', 'battery-surf-bench' ),
		),
	),
);

// The viewport's `src` is owned by the Interactivity API: `data-wp-bind--src`
// sets it from the store's derived `currentSrc` on hydration. No server-side
// `src` is rendered — the Interactivity runtime processes the binding during
// server render too, and would strip a literal value since the derived getter
// is defined client-side.
$bsb_markup = ( new CockpitView() )->render(
	array(
		'wrapper'            => get_block_wrapper_attributes(),
		'context'            => wp_interactivity_data_wp_context( $bsb_context ),
		'brand_title'        => __( 'Battery Surf Bench', 'battery-surf-bench' ),
		'brand_subtitle'     => __( 'Cockpit', 'battery-surf-bench' ),
		'mode_label'         => __( 'Mode', 'battery-surf-bench' ),
		'duration_mode'      => __( 'Duration', 'battery-surf-bench' ),
		'target_drop_mode'   => __( 'Target drop', 'battery-surf-bench' ),
		'duration_label'     => __( 'Run duration', 'battery-surf-bench' ),
		'minutes_label'      => __( 'min', 'battery-surf-bench' ),
		'decrease_label'     => __( 'Decrease duration', 'battery-surf-bench' ),
		'increase_label'     => __( 'Increase duration', 'battery-surf-bench' ),
		'target_label'       => __( 'Stop at battery', 'battery-surf-bench' ),
		'target_aria'        => __( 'Target battery percentage', 'battery-surf-bench' ),
		'baseline_label'     => __( 'Baseline calibration', 'battery-surf-bench' ),
		'speed_label'        => __( 'Speed', 'battery-surf-bench' ),
		'battery_label'      => __( 'Battery', 'battery-surf-bench' ),
		'rate10_label'       => __( 'Rate · 10 min', 'battery-surf-bench' ),
		'rate_session_label' => __( 'Rate · session', 'battery-surf-bench' ),
		'tte_label'          => __( '100% → 0%', 'battery-surf-bench' ),
		'target_short_label' => __( 'Target', 'battery-surf-bench' ),
		'surfing_label'      => __( 'Surfing', 'battery-surf-bench' ),
		'elapsed_label'      => __( 'elapsed', 'battery-surf-bench' ),
		'remaining_label'    => __( 'left', 'battery-surf-bench' ),
		'start_label'        => __( 'Start', 'battery-surf-bench' ),
		'stop_label'         => __( 'Stop', 'battery-surf-bench' ),
		'plugged_label'      => __( 'Plugged in', 'battery-surf-bench' ),
		'compact_label'      => __( 'Compact the dashboard', 'battery-surf-bench' ),
		'expand_label'       => __( 'Expand the dashboard', 'battery-surf-bench' ),
		'sound_label'        => __( 'Toggle the end-of-run sound', 'battery-surf-bench' ),
		'viewport_title'     => __( 'Surf viewport', 'battery-surf-bench' ),
		'shield_label'       => __( 'View only while the run is surfing', 'battery-surf-bench' ),
		'greeting_lead'      => __( 'Greetings from', 'battery-surf-bench' ),
		'idle_heading'       => __( 'How this run works', 'battery-surf-bench' ),
		'idle_subtitle'      => __( 'a controlled, repeatable battery run.', 'battery-surf-bench' ),
		'idle_step1_title'   => __( 'Set the session', 'battery-surf-bench' ),
		'idle_step1_text'    => __( 'Pick a run length, or a battery % to stop at.', 'battery-surf-bench' ),
		'idle_step2_title'   => __( 'Drop in', 'battery-surf-bench' ),
		'idle_step2_text'    => __( 'Hit Start. The charger unplugs and the run begins on its own.', 'battery-surf-bench' ),
		'idle_step3_title'   => __( 'Watch the slope', 'battery-surf-bench' ),
		'idle_step3_text'    => __( 'It runs hands-free while the battery drains; you just watch the numbers.', 'battery-surf-bench' ),
		'dropped_label'      => __( 'Dropped', 'battery-surf-bench' ),
		'pts_label'          => __( 'pts', 'battery-surf-bench' ),
		'elapsed_run_label'  => __( 'Elapsed', 'battery-surf-bench' ),
		'new_run_label'      => __( 'New run', 'battery-surf-bench' ),
		'flip_label'         => __( 'Flip', 'battery-surf-bench' ),
		'measured_label'     => __( 'Measured', 'battery-surf-bench' ),
		'projected_label'    => __( 'Projected 100 → 0', 'battery-surf-bench' ),
		'summary_brand'      => __( 'BATTERY · SURF · BENCH', 'battery-surf-bench' ),
		'idle_notice_title'  => __( 'Keep the laptop open', 'battery-surf-bench' ),
		'idle_notice_text'   => __( 'Keep the laptop\'s lid open for the whole run. If the screen goes dark, the run can\'t measure properly.', 'battery-surf-bench' ),
	)
);

// The view escapes each value and returns finished, trusted markup, so the
// assembled HTML cannot be run through an escaper here.
// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted view-rendered block markup; see comment above.
echo $bsb_markup;
