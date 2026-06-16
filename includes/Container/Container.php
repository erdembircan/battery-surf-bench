<?php

/*
 * SPDX-License-Identifier: Apache-2.0
 * SPDX-FileCopyrightText: 2026 Erdem Bircan
 * license-wizard managed-header v1 Apache-2.0 short 74d1a0534fa2
 */

/**
 * PSR-11 configuration container.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Container;

use Psr\Container\ContainerInterface;

use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * A minimal PSR-11 container used to share configuration and services
 * across the plugin.
 */
class Container implements ContainerInterface {

	/**
	 * Stored entries keyed by identifier.
	 *
	 * @var array<string, mixed>
	 */
	private array $entries = array();

	/**
	 * Registers an entry under the given identifier.
	 *
	 * @param string $id    Identifier of the entry to register.
	 * @param mixed  $value Value to store.
	 */
	public function set( string $id, mixed $value ): void {
		$this->entries[ $id ] = $value;
	}

	/**
	 * Returns the entry stored under the given identifier.
	 *
	 * @param string $id Identifier of the entry to look for.
	 * @throws NotFoundException When no entry is registered for the identifier.
	 * @return mixed The stored entry.
	 */
	public function get( string $id ): mixed {
		if ( ! $this->has( $id ) ) {
			throw new NotFoundException(
				esc_html( sprintf( 'No entry was found for identifier "%s".', $id ) )
			);
		}

		return $this->entries[ $id ];
	}

	/**
	 * Tells whether an entry is registered under the given identifier.
	 *
	 * @param string $id Identifier of the entry to look for.
	 * @return bool Whether the entry exists.
	 */
	public function has( string $id ): bool {
		return array_key_exists( $id, $this->entries );
	}
}
