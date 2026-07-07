<?php
/**
 * Start Benchmark fallback page view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_html;
use function esc_url;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the "Start Benchmark" submenu's fallback page: shown only in the
 * rare case headers were already sent and the
 * {@see \ErdemBircan\BatterySurfBench\Admin\StartBenchmark} manager's
 * server-side redirect to the cockpit could not fire. It owns this markup in
 * a heredoc, behind the {@see View::render()} contract, so the manager
 * prepares the dynamic, already-escaped values and never assembles HTML
 * itself. Kept deliberately minimal — a title, a message and a link — it
 * relies on core's own `.wrap` styling rather than a dedicated stylesheet.
 */
class StartBenchmarkView implements View {

	/**
	 * Renders the fallback page's markup around the given values.
	 *
	 * @param array<string, mixed> $data Raw values the view escapes: `title`, `message`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered page markup.
	 */
	public function render( array $data = array() ): string {
		$title         = esc_html( isset( $data['title'] ) ? (string) $data['title'] : '' );
		$message       = esc_html( isset( $data['message'] ) ? (string) $data['message'] : '' );
		$cockpit_url   = esc_url( isset( $data['cockpit_url'] ) ? (string) $data['cockpit_url'] : '' );
		$cockpit_label = esc_html( isset( $data['cockpit_label'] ) ? (string) $data['cockpit_label'] : '' );

		return <<<HTML
<div class="wrap">
	<h1>{$title}</h1>
	<p>{$message}</p>
	<a href="{$cockpit_url}" target="_blank" rel="noopener noreferrer">{$cockpit_label}</a>
</div>
HTML;
	}
}
