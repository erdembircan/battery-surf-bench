<?php
/**
 * Benchmark sessions listing screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the chrome of the benchmark sessions listing: the wrapped heading, the
 * link that opens the cockpit dashboard, and the empty container the DataViews
 * bundle mounts the grid into. It owns this markup in a heredoc, behind the
 * {@see View::render()} contract, so the {@see \ErdemBircan\BatterySurfBench\Admin\SessionsScreen}
 * manager prepares the dynamic, already-escaped values and never assembles HTML
 * itself.
 */
class SessionsScreenView implements View {

	/**
	 * Renders the listing screen's markup around the given values.
	 *
	 * @param array<string, mixed> $data Already-escaped values: `heading`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered screen markup.
	 */
	public function render( array $data = array() ): string {
		$heading       = isset( $data['heading'] ) ? (string) $data['heading'] : '';
		$cockpit_url   = isset( $data['cockpit_url'] ) ? (string) $data['cockpit_url'] : '';
		$cockpit_label = isset( $data['cockpit_label'] ) ? (string) $data['cockpit_label'] : '';

		return <<<HTML
<div class="wrap"><h1>{$heading} <a href="{$cockpit_url}" class="page-title-action">{$cockpit_label}</a></h1><div id="bsb-sessions-app"></div></div>
HTML;
	}
}
