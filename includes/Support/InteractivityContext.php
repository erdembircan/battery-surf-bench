<?php
/**
 * Interactivity API context encoder.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

use function wp_json_encode;

defined( 'ABSPATH' ) || exit;

/**
 * Encodes a view's Interactivity API context for its `data-wp-context`
 * attribute.
 *
 * Core's `wp_interactivity_data_wp_context()` returns the whole attribute as a
 * string, which a template could only echo unescaped. This encodes the context
 * with the same JSON flags instead, so the template prints the value itself
 * through `esc_attr()`. The flags leave no `&`, `<`, `>`, `'` or `"` in the
 * JSON, so escaping it changes nothing the store reads back.
 */
final class InteractivityContext {

	/**
	 * Encodes a context array as the JSON a `data-wp-context` attribute holds.
	 *
	 * @param array<string, mixed> $context The raw context values.
	 * @return string The JSON text, `{}` for an empty context.
	 */
	public static function encode( array $context ): string {
		if ( array() === $context ) {
			return '{}';
		}

		return (string) wp_json_encode( $context, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP );
	}
}
