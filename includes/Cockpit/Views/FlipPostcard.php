<?php
/**
 * Flip postcard — the shared two-faced postcard that turns in 3D.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit\Views;

use ErdemBircan\BatterySurfBench\Support\View;

use function esc_attr;
use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * The shared flip-card shell: a 3D card with two backface-hidden faces (a picture
 * front and a written back) and a discreet "Flip" badge in the corner of each
 * face. One component so the pre-run startup postcard and the end-of-run summary
 * card turn identically — only their contents and the store wiring differ.
 *
 * The face contents (`front` and `back`) arrive as already-escaped child markup
 * and are placed verbatim; this view escapes only its own slots (the flip label
 * and the directive attributes). The flip state binding and the flip action are
 * passed by the consumer so the same shell can serve different store fields
 * (the startup card's `idleFlipped` vs the summary card's `flipped`).
 */
class FlipPostcard implements View {

	/**
	 * Renders the flip postcard.
	 *
	 * @param array<string, mixed> $data {
	 *     View data.
	 *
	 *     @type string $front       Already-escaped markup for the picture front face.
	 *     @type string $back        Already-escaped markup for the written back face.
	 *     @type string $flip_label  Raw label for the flip badge (the view escapes it).
	 *     @type string $flip_action Store action reference for the flip badge click
	 *                               (e.g. `actions.toggleFlip`).
	 *     @type string $flip_state  Store getter bound to the card's flipped class
	 *                               (e.g. `state.isFlipped`).
	 *     @type string $modifier    Optional extra class on the card (e.g. `bsb-flipcard--idle`).
	 * }
	 * @return string The flip-card markup.
	 */
	public function render( array $data = array() ): string {
		$front       = isset( $data['front'] ) ? (string) $data['front'] : '';
		$back        = isset( $data['back'] ) ? (string) $data['back'] : '';
		$flip_label  = esc_html( isset( $data['flip_label'] ) ? (string) $data['flip_label'] : '' );
		$flip_action = esc_attr( isset( $data['flip_action'] ) ? (string) $data['flip_action'] : '' );
		$flip_state  = esc_attr( isset( $data['flip_state'] ) ? (string) $data['flip_state'] : '' );
		$modifier    = isset( $data['modifier'] ) ? ' ' . esc_attr( (string) $data['modifier'] ) : '';

		return <<<HTML
<div class="bsb-flipcard{$modifier}" data-wp-class--is-flipped="{$flip_state}">
	<div class="bsb-flipcard__face bsb-flipcard__face--front">
		{$front}
		<button type="button" class="bsb-flipcard__flip" data-wp-on--click="{$flip_action}"><span class="bsb-flipcard__flip-icon" aria-hidden="true"></span>{$flip_label}</button>
	</div>
	<div class="bsb-flipcard__face bsb-flipcard__face--back">
		{$back}
		<button type="button" class="bsb-flipcard__flip bsb-flipcard__flip--paper" data-wp-on--click="{$flip_action}"><span class="bsb-flipcard__flip-icon" aria-hidden="true"></span>{$flip_label}</button>
	</div>
</div>
HTML;
	}
}
