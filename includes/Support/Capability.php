<?php
/**
 * Capability abstraction.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

use function current_user_can;

defined( 'ABSPATH' ) || exit;

/**
 * Wraps the plugin's single WordPress capability behind one injectable
 * object, so every gate across the plugin checks and references it the same
 * way instead of each carrying its own `current_user_can()` call or a bare
 * capability string. A consumer that only needs to check authorization calls
 * {@see allows()}; a consumer that must hand WordPress the raw capability
 * string — `add_menu_page()`, `add_submenu_page()`, a post type's
 * `capabilities` map, a `map_meta_cap` mapping — reads it back through
 * {@see slug()}. Built once at bootstrap and injected everywhere a
 * capability check or string was previously threaded through by hand.
 *
 * Consumers depend on {@see CapabilityInterface}, not this concrete class,
 * so a consumer's own tests can inject a fake instead of mocking WordPress
 * globals.
 */
final class Capability implements CapabilityInterface {

	/**
	 * Stores the capability this instance guards.
	 *
	 * @param string $capability The WordPress capability to check and expose.
	 */
	public function __construct( private string $capability ) {
	}

	/**
	 * Reports whether the current user holds the capability.
	 *
	 * @return bool Whether the current user is authorized.
	 */
	public function allows(): bool {
		return current_user_can( $this->capability );
	}

	/**
	 * The raw capability string, for WordPress APIs that require one.
	 *
	 * @return string The wrapped capability.
	 */
	public function slug(): string {
		return $this->capability;
	}
}
