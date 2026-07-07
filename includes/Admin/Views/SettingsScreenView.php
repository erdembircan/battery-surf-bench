<?php
/**
 * Settings screen view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_html;
use function esc_url;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the chrome of the settings screen: a full-bleed coastal "deck" that
 * covers the admin content area, carrying the cockpit-style brand header
 * (surfer mark, wordmark, subtitle) above the empty container the settings
 * bundle mounts its app into. It owns this markup in a heredoc, behind the
 * {@see View::render()} contract, so the
 * {@see \ErdemBircan\BatterySurfBench\Admin\SettingsScreen} manager prepares
 * the dynamic, already-escaped values and never assembles HTML itself.
 *
 * The header carries two action slots: a static "New Benchmark" link that
 * opens the cockpit (rendered here, since its target never changes once the
 * page has loaded) and an empty "Save changes" slot the mounted app portals
 * its own button into — the same pattern
 * {@see \ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView} uses for
 * its running session count, since only the app knows the sequence's dirty,
 * saving and saved state.
 */
class SettingsScreenView implements View {

	/**
	 * Renders the settings screen's markup around the given values.
	 *
	 * @param array<string, mixed> $data Raw values the view escapes: `title`, `subtitle`, `cockpit_url`, `cockpit_label`.
	 * @return string The rendered screen markup.
	 */
	public function render( array $data = array() ): string {
		$title         = esc_html( isset( $data['title'] ) ? (string) $data['title'] : '' );
		$subtitle      = esc_html( isset( $data['subtitle'] ) ? (string) $data['subtitle'] : '' );
		$cockpit_url   = esc_url( isset( $data['cockpit_url'] ) ? (string) $data['cockpit_url'] : '' );
		$cockpit_label = esc_html( isset( $data['cockpit_label'] ) ? (string) $data['cockpit_label'] : '' );

		return <<<HTML
<div class="bsb-settings">
	<header class="bsb-settings__head">
		<span class="bsb-settings__mark" aria-hidden="true"></span>
		<span class="bsb-settings__wordmark">
			<h1 class="bsb-settings__title">{$title}</h1>
			<span class="bsb-settings__subtitle">{$subtitle}</span>
		</span>
		<a class="bsb-settings__pill bsb-settings__launch" href="{$cockpit_url}" target="_blank" rel="noopener noreferrer">
			<span class="bsb-settings__launch-icon" aria-hidden="true"></span>
			{$cockpit_label}
		</a>
		<span class="bsb-settings__save-slot"></span>
	</header>
	<div id="bsb-settings-app"></div>
</div>
HTML;
	}
}
