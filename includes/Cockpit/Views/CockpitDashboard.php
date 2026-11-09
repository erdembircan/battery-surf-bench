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
		return Template::render( __DIR__ . '/Templates/CockpitDashboard.php', $this->template_args( $data ) );
	}

	/**
	 * Prints the dashboard document straight to the output. The document holds
	 * `wp_head()`/`wp_footer()` output, which can't be captured and run through
	 * `wp_kses()`, so the cockpit route prints it with this instead of echoing
	 * {@see CockpitDashboard::render()}.
	 *
	 * @param array<string, mixed> $data The same view data {@see CockpitDashboard::render()} takes.
	 * @return void
	 */
	public function display( array $data = array() ): void {
		Template::display( __DIR__ . '/Templates/CockpitDashboard.php', $this->template_args( $data ) );
	}

	/**
	 * Prepares the values the document template prints.
	 *
	 * @param array<string, mixed> $data The view data.
	 * @return array<string, string> The template arguments.
	 */
	private function template_args( array $data ): array {
		return array(
			'charset'        => get_bloginfo( 'charset' ),
			'title'          => __( 'Battery Surf Bench — Cockpit', 'battery-surf-bench' ),
			'body'           => isset( $data['body'] ) ? (string) $data['body'] : '',
			'devtools_panel' => isset( $data['devtools_panel'] ) ? (string) $data['devtools_panel'] : '',
		);
	}
}
