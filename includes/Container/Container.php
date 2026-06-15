<?php
/**
 * PSR-11 configuration container.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Container;

use Psr\Container\ContainerInterface;

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
	 * @param $id    Identifier of the entry to register.
	 * @param $value Value to store.
	 */
	public function set( string $id, mixed $value ): void {
		$this->entries[ $id ] = $value;
	}

	/**
	 * Returns the entry stored under the given identifier.
	 *
	 * @param $id Identifier of the entry to look for.
	 * @throws NotFoundException When no entry is registered for the identifier.
	 * @return The stored entry.
	 */
	public function get( string $id ): mixed {
		if ( ! $this->has( $id ) ) {
			// phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Framework-level exception message, not rendered as page output.
			throw new NotFoundException( sprintf( 'No entry was found for identifier "%s".', $id ) );
		}

		return $this->entries[ $id ];
	}

	/**
	 * Tells whether an entry is registered under the given identifier.
	 *
	 * @param $id Identifier of the entry to look for.
	 * @return Whether the entry exists.
	 */
	public function has( string $id ): bool {
		return array_key_exists( $id, $this->entries );
	}
}
