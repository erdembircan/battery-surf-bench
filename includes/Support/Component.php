<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * Plugin component contract.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

defined( 'ABSPATH' ) || exit;

/**
 * A self-contained unit of plugin behaviour that wires itself into WordPress.
 *
 * The bootstrap composes components and calls {@see Component::register()} on
 * each one; a component is responsible for hooking whatever WordPress actions
 * or filters it needs. Keeping this behind an interface lets the bootstrap stay
 * ignorant of any single feature and lets each component be tested in isolation.
 */
interface Component {

	/**
	 * Hooks the component into WordPress.
	 *
	 * Called once during plugin boot. Implementations should only register
	 * hooks here, deferring real work to the callbacks those hooks fire.
	 *
	 * @return void
	 */
	public function register(): void;
}
