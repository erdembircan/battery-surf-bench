<?php
/**
 * Admin screen brand header view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_html;

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
 * own trusted static fragment — and is interpolated as-is, never re-escaped,
 * per the View composition rule.
 */
class AdminHeaderView implements View {

	/**
	 * Renders the header around the given values.
	 *
	 * @param array<string, mixed> $data Raw values: `title`, `subtitle` (escaped here), and pre-rendered, trusted `actions` markup (interpolated as-is).
	 * @return string The rendered header markup.
	 */
	public function render( array $data = array() ): string {
		$title    = esc_html( (string) ( $data['title'] ?? '' ) );
		$subtitle = esc_html( (string) ( $data['subtitle'] ?? '' ) );
		$actions  = (string) ( $data['actions'] ?? '' );

		return <<<HTML
<header class="bsb-admin-head">
	<span class="bsb-admin-head__mark" aria-hidden="true"></span>
	<span class="bsb-admin-head__wordmark">
		<h1 class="bsb-admin-head__title">{$title}</h1>
		<span class="bsb-admin-head__subtitle">{$subtitle}</span>
	</span>
	<span class="bsb-admin-head__actions">{$actions}</span>
</header>
HTML;
	}
}
