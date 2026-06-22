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
 * This template only prepares the dynamic, already-escaped values; the markup
 * itself lives in {@see CockpitView}, so no HTML is written inline here.
 *
 * @var array    $attributes Block attributes; `pages` holds the bound course list.
 * @var string   $content    Inner block markup (unused; the cockpit has none yet).
 * @var WP_Block $block      The block instance.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitView;

use function esc_attr__;
use function esc_html__;
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
	'pages'           => $bsb_pages,
	'activeIndex'     => 0,
	'mode'            => 'duration',
	'durationMinutes' => 30,
	'baseline'        => false,
	'speed'           => 1,
	'running'         => false,
	'compact'         => false,
	'elapsed'         => 0,
	'theme'           => 'light',
	'themePref'       => 'system',
	// Seeded at the nominal max; the client caps it down to the current battery
	// level on the first reading, so the slider defaults to "as much as you have".
	'targetPercent'   => 95,
	'batteryLevel'    => null,
	'batteryCharging' => false,
	'rate10'          => null,
	'rateSession'     => null,
	'secondsToEmpty'  => null,
	// The run-summary state machine: a run has not ended yet, with no reason and
	// the card on its picture front. Set when a run stops (whatever the cause).
	'ended'           => false,
	'endReason'       => '',
	'flipped'         => false,
	// Translated summary wording, indexed by end reason; the store picks the set
	// matching how the run ended (kept here so the strings stay translatable).
	'reasonText'      => array(
		'duration'   => array(
			'head' => esc_html__( 'The run is in.', 'battery-surf-bench' ),
			'sig'  => esc_html__( 'Ran the full duration.', 'battery-surf-bench' ),
			'arc'  => esc_html__( '· COMPLETED ·', 'battery-surf-bench' ),
			'unit' => esc_html__( 'run', 'battery-surf-bench' ),
		),
		'targetDrop' => array(
			'head' => esc_html__( 'Target reached.', 'battery-surf-bench' ),
			'sig'  => esc_html__( 'The battery hit your mark.', 'battery-surf-bench' ),
			'arc'  => esc_html__( '· TARGET MET ·', 'battery-surf-bench' ),
			'unit' => esc_html__( 'reached', 'battery-surf-bench' ),
		),
		'stopped'    => array(
			'head' => esc_html__( 'Called it early.', 'battery-surf-bench' ),
			'sig'  => esc_html__( 'You stopped the run.', 'battery-surf-bench' ),
			'arc'  => esc_html__( '· STOPPED ·', 'battery-surf-bench' ),
			'unit' => esc_html__( 'elapsed', 'battery-surf-bench' ),
		),
		'plugged'    => array(
			'head' => esc_html__( 'Plugged back in.', 'battery-surf-bench' ),
			'sig'  => esc_html__( 'The charger ended the run.', 'battery-surf-bench' ),
			'arc'  => esc_html__( '· INTERRUPTED ·', 'battery-surf-bench' ),
			'unit' => esc_html__( 'elapsed', 'battery-surf-bench' ),
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
		'brand_title'        => esc_html__( 'Battery Surf Bench', 'battery-surf-bench' ),
		'brand_subtitle'     => esc_html__( 'Cockpit', 'battery-surf-bench' ),
		'theme_label'        => esc_attr__( 'Toggle light or dark theme', 'battery-surf-bench' ),
		'mode_label'         => esc_html__( 'Mode', 'battery-surf-bench' ),
		'duration_mode'      => esc_html__( 'Duration', 'battery-surf-bench' ),
		'target_drop_mode'   => esc_html__( 'Target drop', 'battery-surf-bench' ),
		'duration_label'     => esc_html__( 'Run duration', 'battery-surf-bench' ),
		'minutes_label'      => esc_html__( 'min', 'battery-surf-bench' ),
		'decrease_label'     => esc_attr__( 'Decrease duration', 'battery-surf-bench' ),
		'increase_label'     => esc_attr__( 'Increase duration', 'battery-surf-bench' ),
		'target_label'       => esc_html__( 'Stop at battery', 'battery-surf-bench' ),
		'target_aria'        => esc_attr__( 'Target battery percentage', 'battery-surf-bench' ),
		'baseline_label'     => esc_html__( 'Baseline calibration', 'battery-surf-bench' ),
		'speed_label'        => esc_html__( 'Speed', 'battery-surf-bench' ),
		'battery_label'      => esc_html__( 'Battery', 'battery-surf-bench' ),
		'rate10_label'       => esc_html__( 'Rate · 10 min', 'battery-surf-bench' ),
		'rate_session_label' => esc_html__( 'Rate · session', 'battery-surf-bench' ),
		'tte_label'          => esc_html__( '100% → 0%', 'battery-surf-bench' ),
		'target_short_label' => esc_html__( 'Target', 'battery-surf-bench' ),
		'surfing_label'      => esc_html__( 'Surfing', 'battery-surf-bench' ),
		'elapsed_label'      => esc_html__( 'elapsed', 'battery-surf-bench' ),
		'remaining_label'    => esc_html__( 'left', 'battery-surf-bench' ),
		'start_label'        => esc_html__( 'Start', 'battery-surf-bench' ),
		'stop_label'         => esc_html__( 'Stop', 'battery-surf-bench' ),
		'plugged_label'      => esc_html__( 'Plugged in', 'battery-surf-bench' ),
		'compact_label'      => esc_attr__( 'Compact the dashboard', 'battery-surf-bench' ),
		'expand_label'       => esc_attr__( 'Expand the dashboard', 'battery-surf-bench' ),
		'viewport_title'     => esc_attr__( 'Surf viewport', 'battery-surf-bench' ),
		'shield_label'       => esc_html__( 'View only while the run is surfing', 'battery-surf-bench' ),
		'greeting_lead'      => esc_html__( 'Greetings from', 'battery-surf-bench' ),
		'idle_heading'       => esc_html__( 'How this run works', 'battery-surf-bench' ),
		'idle_subtitle'      => esc_html__( 'a controlled, repeatable battery run.', 'battery-surf-bench' ),
		'idle_step1_title'   => esc_html__( 'Set the session', 'battery-surf-bench' ),
		'idle_step1_text'    => esc_html__( 'Pick a run length, or a battery % to stop at.', 'battery-surf-bench' ),
		'idle_step2_title'   => esc_html__( 'Drop in', 'battery-surf-bench' ),
		'idle_step2_text'    => esc_html__( 'Hit Start. The charger unplugs and the run begins on its own.', 'battery-surf-bench' ),
		'idle_step3_title'   => esc_html__( 'Watch the slope', 'battery-surf-bench' ),
		'idle_step3_text'    => esc_html__( 'It runs hands-free while the battery drains; you just watch the numbers.', 'battery-surf-bench' ),
		'dropped_label'      => esc_html__( 'Dropped', 'battery-surf-bench' ),
		'pts_label'          => esc_html__( 'pts', 'battery-surf-bench' ),
		'elapsed_run_label'  => esc_html__( 'Elapsed', 'battery-surf-bench' ),
		'new_run_label'      => esc_html__( 'New run', 'battery-surf-bench' ),
		'flip_label'         => esc_html__( 'Flip', 'battery-surf-bench' ),
		'summary_brand'      => esc_html__( 'BATTERY · SURF · BENCH', 'battery-surf-bench' ),
		'idle_notice_title'  => esc_html__( 'Keep the laptop open', 'battery-surf-bench' ),
		'idle_notice_text'   => esc_html__( 'Keep the laptop\'s lid open for the whole run. If the screen goes dark, the run can\'t measure properly.', 'battery-surf-bench' ),
	)
);

// The view interpolates only the already-escaped values prepared above into its
// trusted markup, so the assembled HTML cannot be run through an escaper here.
// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped block markup; see comment above.
echo $bsb_markup;
