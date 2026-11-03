<?php
/**
 * User course page view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Prefixes a real, user-selected page's own title onto its surfed content as
 * a heading, so the page the surf engine renders is faithful to how the page
 * reads on the real site. WordPress keeps a post's title as a field separate
 * from `post_content`, and a real page's raw content carries no heading of
 * its own, so without this the title would be silently dropped from a surfed
 * user page. A bundled catalog page is never routed through this view: its
 * markup already carries its own editorial headline (see
 * {@see \ErdemBircan\BatterySurfBench\Course\CourseRouter}).
 *
 * The heading is emitted as a genuine block so it renders through the same
 * `do_blocks()` pass WordPress already runs the content that follows it
 * through.
 */
class UserPageView implements View {

	/**
	 * Renders the page title as a heading above its block content.
	 *
	 * @param array<string, mixed> $data {
	 *     View data.
	 *
	 *     @type string $title   Raw page title (the template escapes it).
	 *     @type string $content Serialized block markup for the page body, already trusted and appended as-is.
	 * }
	 * @return string The title heading followed by the page's content, as serialized block markup.
	 */
	public function render( array $data = array() ): string {
		$title   = isset( $data['title'] ) ? (string) $data['title'] : '';
		$content = isset( $data['content'] ) ? (string) $data['content'] : '';

		return Template::render( __DIR__ . '/Templates/UserPageHeading.php', array( 'title' => $title ) ) . "\n\n" . $content;
	}
}
