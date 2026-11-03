<?php
/**
 * Admin screen brand header view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the brand header shared by every admin screen the plugin owns: the
 * surfer mark, wordmark (title + subtitle), and a header-right `actions` slot.
 * {@see \ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView} and
 * {@see \ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView} both
 * compose this view instead of duplicating the header markup, so a design
 * change to the header updates every admin screen at once.
 *
 * The `actions` slot carries composed markup — another view's already-escaped
 * output (typically one or more {@see AdminPillView} renders), or a screen's
 * own trusted static fragment — and is printed as-is, never re-escaped,
 * per the View composition rule.
 */
class AdminHeaderView implements View {

	/**
	 * Renders the header around the given values.
	 *
	 * @param array<string, mixed> $data Raw values: `title`, `subtitle` (escaped by the template), and pre-rendered, trusted `actions` markup (printed as-is).
	 * @return string The rendered header markup.
	 */
	public function render( array $data = array() ): string {
		return Template::render(
			__DIR__ . '/Templates/AdminHeader.php',
			array(
				'title'    => (string) ( $data['title'] ?? '' ),
				'subtitle' => (string) ( $data['subtitle'] ?? '' ),
				'actions'  => (string) ( $data['actions'] ?? '' ),
			)
		);
	}
}
