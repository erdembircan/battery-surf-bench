<?php
/**
 * View contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * A self-contained piece of markup. A view owns its HTML — kept inside the
 * implementation as a heredoc, never written inline in the surrounding PHP — and
 * turns the data it is handed into a finished, ready-to-print string. Because
 * the view owns the markup, it owns the escaping: it escapes every dynamic value
 * at the point of output, with the function matching the slot (`esc_html()` for
 * text, `esc_attr()` for attributes, `esc_url()` for URLs). Consumers (a manager,
 * a block render template) supply the raw, translated values and place the
 * returned markup; they never escape ahead of the view, nor assemble HTML
 * themselves. The exception is composed markup — another view's rendered output —
 * which is already escaped and is interpolated as-is, never re-escaped.
 */
interface View {

	/**
	 * Renders the view to an HTML string.
	 *
	 * @param array<string, mixed> $data Raw (translated) values the view escapes and interpolates into its markup.
	 * @return string The rendered HTML.
	 */
	public function render( array $data = array() ): string;
}
