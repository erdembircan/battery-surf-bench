<?php
/**
 * Settings screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the chrome of the settings screen: a full-bleed coastal "deck" that
 * covers the admin content area, carrying the shared {@see AdminHeaderView}
 * brand header above the empty container the settings bundle mounts its app
 * into. It owns this markup in a heredoc, behind the {@see View::render()}
 * contract, so the {@see \ErdemBircan\BatterySurfBench\Admin\SettingsScreen}
 * manager prepares the dynamic, raw values and never assembles HTML itself.
 * Escaping is delegated to the composed views ({@see AdminHeaderView},
 * {@see AdminPillView}), which own the slots the raw values actually land in.
 *
 * The header carries two action slots: a static "New Benchmark" link that
 * opens the cockpit (an {@see AdminPillView} `outline` pill, rendered here
 * since its target never changes once the page has loaded) and an empty
 * "Save changes" slot the mounted app portals its own `solid` pill button
 * into, since only the app knows the sequence's dirty, saving and saved state.
 */
class SettingsScreenView implements View {

	/**
	 * Renders the settings screen's markup around the given values.
	 *
	 * @param array<string, mixed> $data Raw values: `title`, `subtitle`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered screen markup.
	 */
	public function render( array $data = array() ): string {
		$title         = isset( $data['title'] ) ? (string) $data['title'] : '';
		$subtitle      = isset( $data['subtitle'] ) ? (string) $data['subtitle'] : '';
		$cockpit_url   = isset( $data['cockpit_url'] ) ? (string) $data['cockpit_url'] : '';
		$cockpit_label = isset( $data['cockpit_label'] ) ? (string) $data['cockpit_label'] : '';

		$launch_pill = ( new AdminPillView() )->render(
			array(
				'label'   => $cockpit_label,
				'variant' => 'outline',
				'href'    => $cockpit_url,
				'target'  => '_blank',
				'icon'    => 'external',
			)
		);

		// The app portals its own Save button into this empty slot.
		$actions = <<<HTML
{$launch_pill}<span class="bsb-settings__save-slot"></span>
HTML;

		$header = ( new AdminHeaderView() )->render(
			array(
				'title'    => $title,
				'subtitle' => $subtitle,
				'actions'  => $actions,
			)
		);

		return <<<HTML
<div class="bsb-settings">
	{$header}
	<div id="bsb-settings-app"></div>
</div>
HTML;
	}
}
