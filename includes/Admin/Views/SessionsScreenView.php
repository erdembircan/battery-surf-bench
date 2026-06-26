<?php
/**
 * Benchmark sessions listing screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_html;
use function esc_url;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the chrome of the benchmark sessions listing: a full-bleed coastal
 * "deck" that covers the admin content area, carrying the cockpit-style brand
 * header (surfer mark, wordmark, subtitle and the link that opens the cockpit)
 * above the empty container the DataViews bundle mounts the grid into. It owns
 * this markup in a heredoc, behind the {@see View::render()} contract, so the
 * {@see \ErdemBircan\BatterySurfBench\Admin\SessionsScreen} manager prepares the
 * dynamic, already-escaped values and never assembles HTML itself.
 */
class SessionsScreenView implements View {

	/**
	 * Renders the listing screen's markup around the given values.
	 *
	 * @param array<string, mixed> $data Raw values the view escapes: `title`, `subtitle`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered screen markup.
	 */
	public function render( array $data = array() ): string {
		$title         = esc_html( isset( $data['title'] ) ? (string) $data['title'] : '' );
		$subtitle      = esc_html( isset( $data['subtitle'] ) ? (string) $data['subtitle'] : '' );
		$cockpit_url   = esc_url( isset( $data['cockpit_url'] ) ? (string) $data['cockpit_url'] : '' );
		$cockpit_label = esc_html( isset( $data['cockpit_label'] ) ? (string) $data['cockpit_label'] : '' );

		// The running total is filled in live by the grid bundle (it has the
		// fetched records and stays correct after a delete); this slot starts
		// empty so a stale server-rendered number can't double up.
		return <<<HTML
<div class="bsb-sessions">
	<header class="bsb-sessions__head">
		<span class="bsb-sessions__mark" aria-hidden="true"></span>
		<span class="bsb-sessions__wordmark">
			<h1 class="bsb-sessions__title">{$title}</h1>
			<span class="bsb-sessions__subtitle">{$subtitle}</span>
		</span>
		<span class="bsb-sessions__count"></span>
		<a class="bsb-sessions__cockpit" href="{$cockpit_url}" target="_blank" rel="noopener noreferrer">
			<svg class="bsb-sessions__cockpit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
			{$cockpit_label}
		</a>
	</header>
	<div id="bsb-sessions-app"></div>
</div>
HTML;
	}
}
