<?php
/**
 * Admin pill button/link view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_attr;
use function esc_html;
use function esc_url;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the one pill button every admin screen's header uses for its
 * actions: a filled `solid` variant (the screen's primary action) or a teal
 * `outline` secondary, as either a link (when `href` is given) or a
 * `<button>`. {@see \ErdemBircan\BatterySurfBench\Admin\Views\SessionsScreenView}
 * and {@see \ErdemBircan\BatterySurfBench\Admin\Views\SettingsScreenView} both
 * compose this view for their header actions instead of each owning a
 * duplicated pill, so a single component governs every admin pill's markup —
 * the settings app's React `SaveButton` renders the same
 * `.bsb-admin-pill.bsb-admin-pill--solid` classes directly for the one case a
 * pill's state (saving/saved) is driven entirely client-side.
 */
class AdminPillView implements View {

	/**
	 * Renders the pill around the given values.
	 *
	 * @param array<string, mixed> $data Raw values the view escapes: `label`, `variant` (`solid`|`outline`, defaults to `solid`), `href` (renders an `<a>` instead of a `<button>` when non-empty), `target`, `icon` (e.g. `external`).
	 * @return string The rendered pill markup.
	 */
	public function render( array $data = array() ): string {
		$label   = esc_html( (string) ( $data['label'] ?? '' ) );
		$variant = isset( $data['variant'] ) && 'outline' === $data['variant'] ? 'outline' : 'solid';
		$href    = isset( $data['href'] ) && '' !== $data['href'] ? esc_url( (string) $data['href'] ) : '';
		$target  = esc_attr( (string) ( $data['target'] ?? '' ) );
		$icon    = esc_attr( (string) ( $data['icon'] ?? '' ) );

		$class       = "bsb-admin-pill bsb-admin-pill--{$variant}";
		$icon_markup = '' === $icon
			? ''
			: "<span class=\"bsb-admin-pill__icon bsb-admin-pill__icon--{$icon}\" aria-hidden=\"true\"></span>";

		if ( '' !== $href ) {
			$target_attr = '' === $target ? '' : " target=\"{$target}\" rel=\"noopener noreferrer\"";

			return <<<HTML
<a class="{$class}" href="{$href}"{$target_attr}>{$icon_markup}{$label}</a>
HTML;
		}

		return <<<HTML
<button type="button" class="{$class}">{$icon_markup}{$label}</button>
HTML;
	}
}
