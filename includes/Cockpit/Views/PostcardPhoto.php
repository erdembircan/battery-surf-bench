<?php
/**
 * Postcard photo — the illustrated "picture" face of a postcard.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\Template;
use ErdemBircan\BatterySurfBench\Support\View;

defined( 'ABSPATH' ) || exit;

/**
 * The shared picture side of the cockpit's postcards: the surfer mark over a
 * sunset wash with a "Greetings from" greeting. One component so the idle
 * postcard and the run-summary card show the identical illustration instead of
 * drifting copies.
 */
class PostcardPhoto implements View {

	/**
	 * Renders the photo face.
	 *
	 * @param array<string, mixed> $data View data: raw `greeting_lead` and `brand_title`
	 *                                    (the template escapes them), and an optional `modifier`
	 *                                    class (e.g. `bsb-photo--fill`).
	 * @return string The photo markup.
	 */
	public function render( array $data = array() ): string {
		$greeting_lead = isset( $data['greeting_lead'] ) ? (string) $data['greeting_lead'] : '';
		$brand_title   = isset( $data['brand_title'] ) ? (string) $data['brand_title'] : '';
		$modifier      = isset( $data['modifier'] ) ? ' ' . (string) $data['modifier'] : '';

		return Template::render(
			__DIR__ . '/Templates/PostcardPhoto.php',
			array(
				'modifier'      => $modifier,
				'greeting_lead' => $greeting_lead,
				'brand_title'   => $brand_title,
			)
		);
	}
}
