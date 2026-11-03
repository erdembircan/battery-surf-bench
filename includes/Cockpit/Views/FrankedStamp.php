<?php
/**
 * Franked stamp — a postage stamp with a cancellation postmark stamped over it.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * A reusable franked stamp: a perforated postage stamp with — when enabled — a
 * round cancellation postmark stamped over it, deliberately askew. The component
 * is absolutely-positioned so it never pushes the layout it sits on. The
 * cancellation's verdict text (the lower arc, value and unit) is left empty by
 * default and painted by the store's `renderSummary` watch, since the
 * Interactivity runtime cannot process directives inside SVG during server
 * render; a caller that needs a fixed, non-reactive postmark (e.g. the
 * unsupported-browser warning) can pass `arc`/`val`/`unit` to letter it
 * server-side instead.
 *
 * The cancellation is gated by `cancel_enabled`: the end-of-run summary franks
 * its stamp (a cancelled postmark reads as "this run is done"), while the
 * pre-run startup postcard shows a blank, uncancelled stamp. A `modifier` class
 * (e.g. `bsb-frank--warning`) recolours the postmark for distinct states.
 */
class FrankedStamp implements View {

	/**
	 * Renders the franked stamp.
	 *
	 * @param array<string, mixed> $data {
	 *     View data.
	 *
	 *     @type string $brand          Raw upper curved label (the template escapes it).
	 *     @type bool   $cancel_enabled Whether to stamp the cancellation postmark over the
	 *                                  stamp. Defaults to true; pass false for a blank stamp.
	 *     @type string $arc            Raw lower curved label for a fixed postmark; left empty
	 *                                  (painted by the summary watch) when omitted.
	 *     @type string $val            Raw centre value for a fixed postmark; empty when omitted.
	 *     @type string $unit           Raw centre unit label for a fixed postmark; empty when omitted.
	 *     @type string $modifier       Optional extra class on the stamp (e.g. `bsb-frank--warning`).
	 * }
	 * @return string The franked-stamp markup.
	 */
	public function render( array $data = array() ): string {
		$brand          = isset( $data['brand'] ) ? (string) $data['brand'] : '';
		$cancel_enabled = ! isset( $data['cancel_enabled'] ) || (bool) $data['cancel_enabled'];
		$arc            = isset( $data['arc'] ) ? (string) $data['arc'] : '';
		$val            = isset( $data['val'] ) ? (string) $data['val'] : '';
		$unit           = isset( $data['unit'] ) ? (string) $data['unit'] : '';
		$modifier       = isset( $data['modifier'] ) ? ' ' . (string) $data['modifier'] : '';

		// The cancellation postmark — only stamped when enabled. A blank stamp
		// (startup postcard) is the bare perforated stamp with no postmark over it.
		$cancel = '';
		if ( $cancel_enabled ) {
			$cancel = Template::render(
				__DIR__ . '/Templates/FrankedStampCancel.php',
				array(
					'brand' => $brand,
					'arc'   => $arc,
					'val'   => $val,
					'unit'  => $unit,
				)
			);
		}

		return Template::render(
			__DIR__ . '/Templates/FrankedStamp.php',
			array(
				'modifier' => $modifier,
				'cancel'   => $cancel,
			)
		);
	}
}
