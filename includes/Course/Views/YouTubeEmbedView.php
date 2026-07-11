<?php
/**
 * YouTube embed iframe view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course\Views;

use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Owns the markup of the deterministic, JS-API-controllable YouTube iframe
 * {@see \ErdemBircan\BatterySurfBench\Course\YouTubeEmbed} builds as the
 * offline base for `pre_oembed_result`.
 *
 * Unlike most views, this one receives its `src` and `title` ALREADY
 * escaped: `YouTubeEmbed` must build and escape the exact same control-param
 * URL for both the `pre_oembed_result` base this view renders and the
 * `embed_oembed_html` normalizer (which edits an existing iframe's `src`
 * attribute via `WP_HTML_Tag_Processor`, not through this view at all) — so
 * that single URL-building routine, and its escaping, lives once in the
 * service rather than being duplicated here for only one of the two paths.
 */
class YouTubeEmbedView implements View {

	/**
	 * Renders the iframe.
	 *
	 * @param array<string, mixed> $data {
	 *     View data.
	 *
	 *     @type string $src   Already-escaped (`esc_url`) iframe src.
	 *     @type string $title Already-escaped (`esc_attr__`) iframe title.
	 * }
	 * @return string The rendered iframe markup.
	 */
	public function render( array $data = array() ): string {
		$src   = isset( $data['src'] ) ? (string) $data['src'] : '';
		$title = isset( $data['title'] ) ? (string) $data['title'] : '';

		return <<<HTML
<iframe src="{$src}" title="{$title}" width="1200" height="675" frameborder="0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
HTML;
	}
}
