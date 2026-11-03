<?php
/**
 * Settings screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the chrome of the settings screen: a full-bleed coastal "deck" that
 * covers the admin content area, carrying the shared {@see AdminHeaderView}
 * brand header above the empty container the settings bundle mounts its app
 * into. It owns this markup in its templates, behind the {@see View::render()}
 * contract, so the {@see \ErdemBircan\BatterySurfBench\Admin\SettingsScreen}
 * manager prepares the dynamic, raw values and never assembles HTML itself.
 * Escaping is delegated to the composed views ({@see AdminHeaderView},
 * {@see AdminPillView}), which own the slots the raw values actually land in.
 *
 * The header carries two action slots: a static "New Benchmark" link that
 * opens the cockpit (an {@see AdminPillView} `outline` pill, rendered here
 * since its target never changes once the page has loaded) and an empty slot
 * the mounted app portals its own "Reset changes" (`outline`) and "Save
 * changes" (`solid`) pill buttons into together, since only the app knows the
 * sequence's dirty, saving and saved state.
 */
class SettingsScreenView implements View {

	/**
	 * Renders the settings screen's markup around the given values.
	 *
	 * @param array<string, mixed> $data Raw values: `title`, `subtitle`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered screen markup.
	 */
	public function render( array $data = array() ): string {
		$title         = (string) ( $data['title'] ?? '' );
		$subtitle      = (string) ( $data['subtitle'] ?? '' );
		$cockpit_url   = (string) ( $data['cockpit_url'] ?? '' );
		$cockpit_label = (string) ( $data['cockpit_label'] ?? '' );

		$launch_pill = ( new AdminPillView() )->render(
			array(
				'label'   => $cockpit_label,
				'variant' => 'outline',
				'href'    => $cockpit_url,
				'target'  => '_blank',
				'icon'    => 'external',
			)
		);

		// The app portals its own Reset and Save buttons into this empty slot.
		$actions = Template::render(
			__DIR__ . '/Templates/SettingsScreenActions.php',
			array( 'launch_pill' => $launch_pill )
		);

		$header = ( new AdminHeaderView() )->render(
			array(
				'title'    => $title,
				'subtitle' => $subtitle,
				'actions'  => $actions,
			)
		);

		return Template::render(
			__DIR__ . '/Templates/SettingsScreen.php',
			array( 'header' => $header )
		);
	}
}
