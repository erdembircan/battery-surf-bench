<?php
/**
 * Admin pill button/link view.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Admin\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

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
	 * @param array<string, mixed> $data Raw values the template escapes: `label`, `variant` (`solid`|`outline`, defaults to `solid`), `href` (renders an `<a>` instead of a `<button>` when non-empty), `target`, `icon` (e.g. `external`).
	 * @return string The rendered pill markup.
	 */
	public function render( array $data = array() ): string {
		$label   = (string) ( $data['label'] ?? '' );
		$variant = isset( $data['variant'] ) && 'outline' === $data['variant'] ? 'outline' : 'solid';
		$href    = isset( $data['href'] ) && '' !== $data['href'] ? (string) $data['href'] : '';
		$target  = (string) ( $data['target'] ?? '' );
		$icon    = (string) ( $data['icon'] ?? '' );

		$icon_markup = '' === $icon
			? ''
			: Template::render( __DIR__ . '/Templates/AdminPillIcon.php', array( 'icon' => $icon ) );

		if ( '' !== $href && '' !== $target ) {
			return Template::render(
				__DIR__ . '/Templates/AdminPillNewTab.php',
				array(
					'variant'     => $variant,
					'href'        => $href,
					'target'      => $target,
					'icon_markup' => $icon_markup,
					'label'       => $label,
				)
			);
		}

		if ( '' !== $href ) {
			return Template::render(
				__DIR__ . '/Templates/AdminPill.php',
				array(
					'variant'     => $variant,
					'href'        => $href,
					'icon_markup' => $icon_markup,
					'label'       => $label,
				)
			);
		}

		return Template::render(
			__DIR__ . '/Templates/AdminPillButton.php',
			array(
				'variant'     => $variant,
				'icon_markup' => $icon_markup,
				'label'       => $label,
			)
		);
	}
}
