<?php
/**
 * View contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * A self-contained piece of markup. A view prepares the data it is handed and
 * renders its markup from PHP template files in its `Templates/` folder (see
 * {@see Template}), never from markup written in its own methods, and returns
 * a finished, ready-to-print string. The template escapes every dynamic value
 * at the point of output, with the function matching the slot (`esc_html()`
 * for text, `esc_attr()` for attributes, `esc_url()` for URLs), so the view
 * hands it raw values. Consumers (a manager, a block render template) supply
 * the raw, translated values and place the returned markup; they never escape
 * ahead of the view, nor assemble HTML themselves. The exception is composed
 * markup — another view's rendered output — which is already escaped and is
 * printed as-is, never re-escaped.
 */
interface View {

	/**
	 * Renders the view to an HTML string.
	 *
	 * @param array<string, mixed> $data Raw (translated) values the view hands to its template, which escapes and prints them.
	 * @return string The rendered HTML.
	 */
	public function render( array $data = array() ): string;
}
