<?php
/**
 * Stored-session detail view — the summary postcard for one saved run.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_html;
use function esc_url;
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the detail page for one stored benchmark session: the same run-summary
 * postcard the live cockpit shows at run end, raised on its own. The page is an
 * Interactivity region on the `bsb/cockpit` store — the cockpit's view module is
 * enqueued for it — with the run's frozen readouts seeded onto the per-instance
 * context. On hydration `callbacks.initDetail` rebuilds the drain graph from the
 * seeded samples and, a beat after the appear animation settles, auto-flips the
 * card to its report back, the same self-reveal "New run" gives the startup card.
 *
 * The card itself is the shared {@see SummaryCard}; this view supplies its
 * picture front, its franked stamp, and a footer link back to the listing
 * instead of the live "New run" button. The block render template prepares the
 * raw (translated) values and the seeded context; this view escapes each into
 * its slot and owns the wrapper markup.
 */
class SessionDetailView implements View {

	/**
	 * Renders the session detail page body.
	 *
	 * @param array<string, mixed> $data {
	 *     Raw (translated) values and the seeded context.
	 *
	 *     @type string $context            `data-wp-context` attribute from `wp_interactivity_data_wp_context()`.
	 *     @type string $greeting_lead      Raw "Greetings from" lead for the picture front.
	 *     @type string $brand_title        Raw plugin name shown on the front and stamp.
	 *     @type string $summary_brand      Raw wordmark curved around the franked stamp.
	 *     @type string $flip_label         Raw label for the flip badge.
	 *     @type string $tte_label          Raw label for the time-to-empty stat.
	 *     @type string $rate_session_label Raw label for the session drain-rate stat.
	 *     @type string $rate10_label       Raw label for the 10-minute drain-rate stat.
	 *     @type string $battery_label      Raw label for the battery start→end stat.
	 *     @type string $dropped_label      Raw label for the dropped-points stat.
	 *     @type string $pts_label          Raw unit label for the dropped-points stat.
	 *     @type string $elapsed_run_label  Raw label for the elapsed-run stat.
	 *     @type string $measured_label     Raw legend label for the measured drain series.
	 *     @type string $projected_label    Raw legend label for the 100→0 projection.
	 *     @type string $back_label         Raw label for the back-to-listing link.
	 *     @type string $back_url           URL of the sessions listing screen.
	 *     @type string $devtools_panel     Pre-rendered dev-tools panel markup, empty outside a dev environment.
	 * }
	 * @return string The detail page body markup.
	 */
	public function render( array $data = array() ): string {
		$context        = isset( $data['context'] ) ? (string) $data['context'] : '';
		$greeting_lead  = isset( $data['greeting_lead'] ) ? (string) $data['greeting_lead'] : '';
		$brand_title    = isset( $data['brand_title'] ) ? (string) $data['brand_title'] : '';
		$summary_brand  = isset( $data['summary_brand'] ) ? (string) $data['summary_brand'] : '';
		$back_label     = esc_html( isset( $data['back_label'] ) ? (string) $data['back_label'] : '' );
		$back_url       = esc_url( isset( $data['back_url'] ) ? (string) $data['back_url'] : '' );
		$devtools_panel = isset( $data['devtools_panel'] ) ? (string) $data['devtools_panel'] : '';

		// The shared postcard pieces: the picture front (greeting) and the franked
		// (cancelled) stamp, built from the raw values — each child view escapes
		// what it is handed — exactly as the cockpit composes them.
		$front = ( new PostcardPhoto() )->render(
			array(
				'greeting_lead' => $greeting_lead,
				'brand_title'   => $brand_title,
				'modifier'      => 'bsb-photo--fill',
			)
		);
		$frank = ( new FrankedStamp() )->render( array( 'brand' => $summary_brand ) );

		// The footer is a link back to the listing rather than the live "New run"
		// button — the run is already over and stored.
		$footer = sprintf(
			'<a class="bsb-summary__new bsb-summary__back" href="%s">%s</a>',
			$back_url,
			$back_label
		);

		$summary = ( new SummaryCard() )->render(
			array(
				'front'              => $front,
				'frank'              => $frank,
				'footer'             => $footer,
				'flip_label'         => $data['flip_label'] ?? '',
				'tte_label'          => $data['tte_label'] ?? '',
				'rate_session_label' => $data['rate_session_label'] ?? '',
				'rate10_label'       => $data['rate10_label'] ?? '',
				'battery_label'      => $data['battery_label'] ?? '',
				'dropped_label'      => $data['dropped_label'] ?? '',
				'pts_label'          => $data['pts_label'] ?? '',
				'elapsed_run_label'  => $data['elapsed_run_label'] ?? '',
				'measured_label'     => $data['measured_label'] ?? '',
				'projected_label'    => $data['projected_label'] ?? '',
				// Shown at once (not raised on run end as in the live cockpit), so
				// the postcard's picture front sails in immediately on load.
				'start_hidden'       => false,
			)
		);

		// The detail wrapper carries the theme tokens and the full-bleed sky the
		// `.bsb-summary` overlay paints against (the cockpit's own wrapper supplies
		// these in the live dashboard). It is an Interactivity region on the
		// `bsb/cockpit` store; `callbacks.initDetail` builds the graph and arms the
		// auto-flip on hydration.
		return <<<HTML
<div class="bsb-session-detail" data-wp-interactive="bsb/cockpit" {$context} data-wp-init="callbacks.initDetail">
	{$summary}
</div>
{$devtools_panel}
HTML;
	}
}
