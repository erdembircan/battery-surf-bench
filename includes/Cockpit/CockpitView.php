<?php
/**
 * Cockpit block view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the `bsb/cockpit` block's front-end markup: the Interactivity-driven
 * region wrapping the page controls and the viewport iframe. The block's server
 * render template ({@see src/cockpit/render.php}) prepares the dynamic,
 * already-escaped values — the block wrapper attributes, the per-instance
 * `data-wp-context`, and the translated control labels — and hands them here;
 * this view owns the structure, held in a heredoc, so no HTML is written inline
 * in the render template.
 */
class CockpitView implements View {

	/**
	 * Renders the cockpit block markup.
	 *
	 * @param array<string, mixed> $data {
	 *     Already-escaped values from the block render template.
	 *
	 *     @type string $wrapper        Block wrapper attributes from `get_block_wrapper_attributes()`.
	 *     @type string $context        `data-wp-context` attribute from `wp_interactivity_data_wp_context()`.
	 *     @type string $next_label     Translated, escaped label for the next-page control.
	 *     @type string $viewport_title Translated, escaped title for the viewport iframe.
	 * }
	 * @return string The block's HTML.
	 */
	public function render( array $data = array() ): string {
		$wrapper        = isset( $data['wrapper'] ) ? (string) $data['wrapper'] : '';
		$context        = isset( $data['context'] ) ? (string) $data['context'] : '';
		$next_label     = isset( $data['next_label'] ) ? (string) $data['next_label'] : '';
		$viewport_title = isset( $data['viewport_title'] ) ? (string) $data['viewport_title'] : '';

		return <<<HTML
<div {$wrapper} data-wp-interactive="bsb/cockpit" {$context}>
	<div class="bsb-cockpit__controls">
		<button type="button" class="bsb-cockpit__cycle" data-wp-on--click="actions.next">{$next_label}</button>
		<span class="bsb-cockpit__label" data-wp-text="state.currentLabel"></span>
	</div>
	<iframe class="bsb-cockpit__viewport" title="{$viewport_title}" data-wp-bind--src="state.currentSrc"></iframe>
</div>
HTML;
	}
}
