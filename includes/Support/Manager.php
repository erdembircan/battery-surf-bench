<?php
/**
 * Plugin manager contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * A self-contained slice of plugin behaviour that wires itself into WordPress.
 *
 * The bootstrap composes managers and calls {@see Manager::register()} on each
 * one; a manager is responsible for hooking whatever WordPress actions or
 * filters it needs. Keeping this behind an interface lets the bootstrap stay
 * ignorant of any single feature and lets each manager be tested in isolation.
 */
interface Manager {

	/**
	 * Hooks the manager into WordPress.
	 *
	 * Called once during plugin boot. Implementations should only register
	 * hooks here, deferring real work to the callbacks those hooks fire.
	 *
	 * @return void
	 */
	public function register(): void;
}
