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
 * @var array    $attributes Block attributes; `pages` holds the bound course list.
 * @var string   $content    Inner block markup (unused; the cockpit has none yet).
 * @var WP_Block $block      The block instance.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use function esc_attr__;
use function get_block_wrapper_attributes;
use function wp_interactivity_data_wp_context;

defined( 'ABSPATH' ) || exit;

$bsb_pages = isset( $attributes['pages'] ) && is_array( $attributes['pages'] ) ? $attributes['pages'] : array();

// Per-instance Interactivity context: the surfable pages and which one is
// active. The active page's URL is derived from these on the client (see
// view.ts) and bound onto the iframe, so changing the index later re-points
// the viewport with no reload of the cockpit itself.
$bsb_context = array(
	'pages'       => $bsb_pages,
	'activeIndex' => 0,
);

// The viewport's `src` is owned by the Interactivity API: `data-wp-bind--src`
// sets it from the store's derived `currentSrc` on hydration. No server-side
// `src` is rendered — the Interactivity runtime processes the binding during
// server render too, and would strip a literal value since the derived getter
// is defined client-side.
?>
<div
	<?php echo get_block_wrapper_attributes(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core helper returns escaped attributes. ?>
	data-wp-interactive="bsb/cockpit"
	<?php echo wp_interactivity_data_wp_context( $bsb_context ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core helper returns an escaped data-wp-context attribute. ?>
>
	<iframe
		class="bsb-cockpit__viewport"
		title="<?php echo esc_attr__( 'Surf viewport', 'battery-surf-bench' ); ?>"
		data-wp-bind--src="state.currentSrc"
	></iframe>
</div>
