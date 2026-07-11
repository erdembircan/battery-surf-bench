<?php
/**
 * Capability contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * A single authorization check, abstracted behind an interface rather than a
 * bare capability string or a direct `current_user_can()` call. Every class
 * that used to receive the plugin's capability as a string (or call
 * `current_user_can()` itself) now receives an instance of this interface
 * instead, so:
 *
 * - a consumer's tests can inject a fake implementation whose {@see allows()}
 *   returns a controllable bool, instead of mocking the WordPress
 *   `current_user_can()` global;
 * - a future multi-role policy (e.g. "any of several capabilities") can be
 *   introduced as a second implementation without touching a single consumer.
 *
 * {@see Capability} is the plugin's one production implementation, checking a
 * single WordPress capability.
 */
interface CapabilityInterface {

	/**
	 * Reports whether the current user is authorized.
	 *
	 * @return bool Whether the current user is authorized.
	 */
	public function allows(): bool;

	/**
	 * The raw capability string, for WordPress APIs that require one (e.g.
	 * `add_menu_page()`, a post type's `capabilities` map).
	 *
	 * @return string The capability.
	 */
	public function slug(): string;
}
