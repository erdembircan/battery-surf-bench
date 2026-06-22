<?php
/**
 * Franked stamp — a postage stamp with a cancellation postmark stamped over it.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * A reusable franked stamp: a perforated postage stamp with a round cancellation
 * postmark stamped over it, deliberately askew. The component is
 * absolutely-positioned so it never pushes the layout it sits on. The
 * cancellation's verdict text (the lower arc, value and unit) is left empty here
 * and painted by the store's `renderSummary` watch, since the Interactivity
 * runtime cannot process directives inside SVG during server render.
 */
class FrankedStamp implements View {

	/**
	 * Renders the franked stamp.
	 *
	 * @param array<string, mixed> $data View data: raw `brand` (the view escapes it) for
	 *                                    the postmark's upper curved label.
	 * @return string The franked-stamp markup.
	 */
	public function render( array $data = array() ): string {
		$brand = esc_html( isset( $data['brand'] ) ? (string) $data['brand'] : '' );

		return <<<HTML
<span class="bsb-frank" aria-hidden="true">
	<span class="bsb-frank__stamp"></span>
	<span class="bsb-frank__cancel">
		<svg class="bsb-frank__pm" viewBox="-60 -60 120 120" width="100%" height="100%">
			<defs>
				<path id="bsb-frank-top" d="M-40.5 0 A40.5 40.5 0 0 1 40.5 0"></path>
				<path id="bsb-frank-bot" d="M40.5 0 A40.5 40.5 0 0 1 -40.5 0"></path>
			</defs>
			<path class="bsb-frank__bar" d="M-58 -15 q 13 -5 26 0 t 26 0"></path>
			<path class="bsb-frank__bar" d="M-58 -5 q 13 -5 26 0 t 26 0"></path>
			<path class="bsb-frank__bar" d="M-58 5 q 13 -5 26 0 t 26 0"></path>
			<path class="bsb-frank__bar" d="M-58 15 q 13 -5 26 0 t 26 0"></path>
			<circle class="bsb-frank__ring" cx="0" cy="0" r="47"></circle>
			<circle class="bsb-frank__ring" cx="0" cy="0" r="34"></circle>
			<text class="bsb-frank__arc" text-anchor="middle" dominant-baseline="central"><textPath href="#bsb-frank-top" startOffset="50%">{$brand}</textPath></text>
			<text class="bsb-frank__arc" text-anchor="middle" dominant-baseline="central"><textPath class="bsb-frank__arc-text" href="#bsb-frank-bot" startOffset="50%"></textPath></text>
			<text class="bsb-frank__val" x="0" y="-3" text-anchor="middle" dominant-baseline="central"></text>
			<text class="bsb-frank__unit" x="0" y="11" text-anchor="middle" dominant-baseline="central"></text>
		</svg>
	</span>
</span>
HTML;
	}
}
