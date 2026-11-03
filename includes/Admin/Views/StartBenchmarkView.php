<?php
/**
 * Start Benchmark fallback page view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the "Start Benchmark" submenu's fallback page: shown only in the
 * rare case headers were already sent and the
 * {@see \ErdemBircan\BatterySurfBench\Admin\StartBenchmark} manager's
 * server-side redirect to the cockpit could not fire. It owns this markup in
 * its template, behind the {@see View::render()} contract, so the manager
 * prepares the dynamic, raw values and never assembles HTML
 * itself. Kept deliberately minimal — a title, a message and a link — it
 * relies on core's own `.wrap` styling rather than a dedicated stylesheet.
 */
class StartBenchmarkView implements View {

	/**
	 * Renders the fallback page's markup around the given values.
	 *
	 * @param array<string, mixed> $data Raw values the template escapes: `title`, `message`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered page markup.
	 */
	public function render( array $data = array() ): string {
		return Template::render(
			__DIR__ . '/Templates/StartBenchmark.php',
			array(
				'title'         => (string) ( $data['title'] ?? '' ),
				'message'       => (string) ( $data['message'] ?? '' ),
				'cockpit_url'   => (string) ( $data['cockpit_url'] ?? '' ),
				'cockpit_label' => (string) ( $data['cockpit_label'] ?? '' ),
			)
		);
	}
}
