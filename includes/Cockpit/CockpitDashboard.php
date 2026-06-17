<?php
/**
 * Cockpit dashboard view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use function bloginfo;
use function esc_html_e;
use function language_attributes;
use function wp_footer;
use function wp_head;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the standalone HTML document the cockpit dashboard is served as. It
 * owns only the page's structure — doctype, head, body — and places the
 * pre-rendered cockpit body inside it, letting `wp_head()`/`wp_footer()` print
 * the head tags and the Interactivity API script modules. Keeping the markup
 * here, behind a single {@see CockpitDashboard::render()} call, keeps the
 * {@see Cockpit} manager free of inline HTML and lets each be tested on its own.
 */
class CockpitDashboard {

	/**
	 * Renders the dashboard document around the given body markup.
	 *
	 * @param string $body Pre-rendered cockpit body HTML to place in the document.
	 * @return void
	 */
	public function render( string $body ): void {
		?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="noindex" />
	<title><?php esc_html_e( 'Battery Surf Bench — Cockpit', 'battery-surf-bench' ); ?></title>
	<style>
		html, body { margin: 0; height: 100%; }
		.bsb-cockpit__viewport { display: block; width: 100%; height: 100vh; border: 0; }
	</style>
		<?php wp_head(); ?>
</head>
<body>
		<?php echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-rendered, escaped block HTML from do_blocks(). ?>
		<?php wp_footer(); ?>
</body>
</html>
		<?php
	}
}
