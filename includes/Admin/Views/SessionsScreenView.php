<?php
/**
 * Benchmark sessions listing screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the chrome of the benchmark sessions listing: a full-bleed coastal
 * "deck" that covers the admin content area, carrying the shared
 * {@see AdminHeaderView} brand header above the empty container the DataViews
 * bundle mounts the grid into. It owns this markup in its templates, behind the
 * {@see View::render()} contract, so the
 * {@see \ErdemBircan\BatterySurfBench\Admin\SessionsScreen} manager prepares the
 * dynamic, raw values and never assembles HTML itself. Escaping is delegated
 * to the composed views ({@see AdminHeaderView}, {@see AdminPillView}), which
 * own the slots the raw values actually land in.
 */
class SessionsScreenView implements View {

	/**
	 * Renders the listing screen's markup around the given values.
	 *
	 * @param array<string, mixed> $data Raw values: `title`, `subtitle`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered screen markup.
	 */
	public function render( array $data = array() ): string {
		$title         = (string) ( $data['title'] ?? '' );
		$subtitle      = (string) ( $data['subtitle'] ?? '' );
		$cockpit_url   = (string) ( $data['cockpit_url'] ?? '' );
		$cockpit_label = (string) ( $data['cockpit_label'] ?? '' );

		$cockpit_pill = ( new AdminPillView() )->render(
			array(
				'label'   => $cockpit_label,
				'variant' => 'outline',
				'href'    => $cockpit_url,
				'target'  => '_blank',
				'icon'    => 'external',
			)
		);

		// The running total is filled in live by the grid bundle (it has the
		// fetched records and stays correct after a delete); the actions template
		// carries no dynamic value of its own, and its count slot starts empty so a
		// stale server-rendered number can't double up.
		$actions = Template::render(
			__DIR__ . '/Templates/SessionsScreenActions.php',
			array( 'cockpit_pill' => $cockpit_pill )
		);

		$header = ( new AdminHeaderView() )->render(
			array(
				'title'    => $title,
				'subtitle' => $subtitle,
				'actions'  => $actions,
			)
		);

		return Template::render(
			__DIR__ . '/Templates/SessionsScreen.php',
			array( 'header' => $header )
		);
	}
}
