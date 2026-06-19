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
);

// The viewport's `src` is owned by the Interactivity API: `data-wp-bind--src`
// sets it from the store's derived `currentSrc` on hydration. No server-side
// `src` is rendered — the Interactivity runtime processes the binding during
// server render too, and would strip a literal value since the derived getter
// is defined client-side.
$bsb_markup = ( new CockpitView() )->render(
	array(
		'wrapper'          => get_block_wrapper_attributes(),
		'context'          => wp_interactivity_data_wp_context( $bsb_context ),
		'brand_title'      => esc_html__( 'Battery Surf Bench', 'battery-surf-bench' ),
		'brand_subtitle'   => esc_html__( 'Cockpit', 'battery-surf-bench' ),
		'mode_label'       => esc_html__( 'Mode', 'battery-surf-bench' ),
		'duration_mode'    => esc_html__( 'Duration', 'battery-surf-bench' ),
		'target_drop_mode' => esc_html__( 'Target drop', 'battery-surf-bench' ),
		'duration_label'   => esc_html__( 'Run duration', 'battery-surf-bench' ),
		'minutes_label'    => esc_html__( 'min', 'battery-surf-bench' ),
		'decrease_label'   => esc_attr__( 'Decrease duration', 'battery-surf-bench' ),
		'increase_label'   => esc_attr__( 'Increase duration', 'battery-surf-bench' ),
		'baseline_label'   => esc_html__( 'Baseline calibration', 'battery-surf-bench' ),
		'speed_label'      => esc_html__( 'Speed', 'battery-surf-bench' ),
		'stop_label'       => esc_html__( 'Stop', 'battery-surf-bench' ),
		'next_label'       => esc_html__( 'Next page', 'battery-surf-bench' ),
		'viewport_title'   => esc_attr__( 'Surf viewport', 'battery-surf-bench' ),
	)
);

// The view interpolates only the already-escaped values prepared above into its
// trusted markup, so the assembled HTML cannot be run through an escaper here.
// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-escaped block markup; see comment above.
echo $bsb_markup;
