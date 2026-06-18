<?php
/**
 * Cockpit dashboard view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_attr;
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
 * captured into the document so core still prints the head tags and the
 * Interactivity API script modules. Keeping the markup here, behind the
 * {@see View::render()} contract, keeps the {@see Cockpit} manager free of
 * inline HTML and lets each be tested on its own.
 */
class CockpitDashboard implements View {

	/**
	 * Renders the dashboard document around the given body markup.
	 *
	 * @param array<string, mixed> $data View data; `body` holds the pre-rendered cockpit body HTML.
	 * @return string The complete dashboard document.
	 */
	public function render( array $data = array() ): string {
		$body    = isset( $data['body'] ) ? (string) $data['body'] : '';
		$lang    = get_language_attributes();
		$charset = esc_attr( get_bloginfo( 'charset' ) );
		$title   = esc_html__( 'Battery Surf Bench — Cockpit', 'battery-surf-bench' );
		$styles  = $this->styles();

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
	{$styles}
	{$head}
</head>
<body>
	{$body}
	{$footer}
</body>
</html>
HTML;
	}

	/**
	 * Builds the dashboard's inline stylesheet: a clean-slate layout that fills
	 * the viewport, since the document is served with all theme styles stripped.
	 *
	 * @return string The `<style>` block.
	 */
	private function styles(): string {
		return <<<'HTML'
<style>
		html, body { margin: 0; height: 100%; }
		.wp-block-bsb-cockpit { display: flex; flex-direction: column; height: 100vh; }
		.bsb-cockpit__controls { flex: 0 0 auto; display: flex; gap: 0.75rem; align-items: center; padding: 0.6rem 0.9rem; border-bottom: 1px solid #e8e4dc; font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
		.bsb-cockpit__cycle { cursor: pointer; padding: 0.4rem 0.9rem; border: 1px solid #1a1a18; border-radius: 4px; background: #1a1a18; color: #fff; font: inherit; }
		.bsb-cockpit__label { color: #6b6760; }
		.bsb-cockpit__viewport { flex: 1 1 auto; display: block; width: 100%; border: 0; }
	</style>
HTML;
	}
}
