<?php
/**
 * Cockpit dashboard view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_attr;
use function esc_html;
use function esc_html__;
use function get_bloginfo;
use function get_language_attributes;
use function ob_get_clean;
use function ob_start;
use function wp_footer;
use function wp_head;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the standalone HTML document the cockpit dashboard is served as. It
 * owns only the page's structure — doctype, head, body — held in a heredoc, and
 * places the pre-rendered cockpit body inside it. `wp_head()`/`wp_footer()` are
 * captured into the document so core still prints the head tags, the dashboard
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
	 *     @type string $body  Pre-rendered document body HTML.
	 *     @type string $title Optional document title; defaults to the cockpit's.
	 * }
	 * @return string The complete dashboard document.
	 */
	public function render( array $data = array() ): string {
		$body    = isset( $data['body'] ) ? (string) $data['body'] : '';
		$lang    = get_language_attributes();
		$charset = esc_attr( get_bloginfo( 'charset' ) );
		$title   = isset( $data['title'] )
			? esc_html( (string) $data['title'] )
			: esc_html__( 'Battery Surf Bench — Cockpit', 'battery-surf-bench' );

		ob_start();
		wp_head();
		$head = (string) ob_get_clean();

		ob_start();
		wp_footer();
		$footer = (string) ob_get_clean();

		return <<<HTML
<!DOCTYPE html>
<html {$lang}>
<head>
	<meta charset="{$charset}" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="noindex" />
	<title>{$title}</title>
	{$head}
</head>
<body>
	{$body}
	{$footer}
</body>
</html>
HTML;
	}
}
