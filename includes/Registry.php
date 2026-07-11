<?php
/**
 * Read-only configuration registry.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Exception\NotFoundException;
use Psr\Container\ContainerInterface;

use function array_is_list;
use function esc_html;

defined( 'ABSPATH' ) || exit;

/**
 * An immutable PSR-11 registry that exposes the plugin's configuration.
 *
 * The whole configuration is handed to the constructor once and never changes
 * afterwards; there is no setter. Identifiers use dot notation to reach nested
 * values (e.g. `admin_menu.slug`), and a lookup resolves to either a scalar or
 * a sequential (list) array value; an identifier that lands on an associative
 * array is treated as a namespace to traverse further, not a value, and is
 * not found on its own.
 */
class Registry implements ContainerInterface {

	/**
	 * Stores the configuration entries. The registry is immutable from here on.
	 *
	 * @param array<string, mixed> $entries Associative array of configuration entries.
	 */
	public function __construct( private array $entries ) {
	}

	/**
	 * Returns the scalar or list-array entry stored under the given identifier.
	 *
	 * @param string $id Dot-notated identifier of the entry to look for.
	 * @throws NotFoundException When no scalar or list-array entry resolves for the identifier.
	 * @return mixed The stored entry.
	 */
	public function get( string $id ): mixed {
		if ( ! $this->has( $id ) ) {
			throw new NotFoundException(
				esc_html( sprintf( 'No entry was found for the identifier "%s".', $id ) )
			);
		}

		return $this->resolve( $id );
	}

	/**
	 * Tells whether a scalar or list-array entry resolves for the given
	 * identifier. An associative array is a namespace to traverse, not a
	 * value, so it is not itself "found"; a sequential (list) array is a
	 * value in its own right and is found.
	 *
	 * @param string $id Dot-notated identifier of the entry to look for.
	 * @return bool Whether a scalar or list-array entry exists.
	 */
	public function has( string $id ): bool {
		$current = $this->entries;

		foreach ( $this->segments( $id ) as $segment ) {
			if ( ! is_array( $current ) || ! array_key_exists( $segment, $current ) ) {
				return false;
			}

			$current = $current[ $segment ];
		}

		return ! is_array( $current ) || array_is_list( $current );
	}

	/**
	 * Walks the entries to the value a dot-notated identifier points at.
	 *
	 * @param string $id Dot-notated identifier of the entry.
	 * @return mixed The resolved value.
	 */
	private function resolve( string $id ): mixed {
		$current = $this->entries;

		foreach ( $this->segments( $id ) as $segment ) {
			$current = $current[ $segment ];
		}

		return $current;
	}

	/**
	 * Splits a dot-notated identifier into its segments.
	 *
	 * @param string $id Dot-notated identifier (e.g. `admin_menu.slug`).
	 * @return array<int, string> The identifier's segments.
	 */
	private function segments( string $id ): array {
		return explode( '.', $id );
	}
}
