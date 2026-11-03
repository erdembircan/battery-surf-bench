<?php
/**
 * Cockpit dashboard view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

use function __;
use function get_bloginfo;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the standalone HTML document the cockpit dashboard is served as. It
 * owns only the page's structure — doctype, head, body — held in its template, and
 * places the pre-rendered cockpit body inside it. `wp_head()`/`wp_footer()` are
 * printed into the document so core still prints the head tags, the dashboard
 * stylesheet (the one style the cockpit route spares) and the Interactivity API
 * script modules. Keeping the markup here, behind the {@see View::render()}
 * contract, keeps the {@see Cockpit} manager free of inline HTML and lets each
 * be tested on its own.
 */
class CockpitDashboard implements View {

	/**
	 * Renders the dashboard document around the given body markup.
	 *
	 * @param array<string, mixed> $data {
	 *     View data.
	 *
	 *     @type string $body            Pre-rendered cockpit body HTML.
	 *     @type string $devtools_panel  Pre-rendered dev-tools panel markup, empty outside a dev environment.
	 * }
	 * @return string The complete dashboard document.
	 */
	public function render( array $data = array() ): string {
		$body           = isset( $data['body'] ) ? (string) $data['body'] : '';
		$devtools_panel = isset( $data['devtools_panel'] ) ? (string) $data['devtools_panel'] : '';
		$charset        = get_bloginfo( 'charset' );
		$title          = __( 'Battery Surf Bench — Cockpit', 'battery-surf-bench' );

		return Template::render(
			__DIR__ . '/Templates/CockpitDashboard.php',
			array(
				'charset'        => $charset,
				'title'          => $title,
				'body'           => $body,
				'devtools_panel' => $devtools_panel,
			)
		);
	}
}
