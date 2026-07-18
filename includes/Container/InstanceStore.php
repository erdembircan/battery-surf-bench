<?php
/**
 * Singleton instance store.
 *
 * @package ErdemBircan\BatterySurfBench\Container
 */

namespace ErdemBircan\BatterySurfBench\Container;

use ErdemBircan\BatterySurfBench\Exception\NotFoundException;
use Psr\Container\ContainerInterface;

use function array_key_exists;
use function esc_html;
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * A pure PSR-11 store of already-built singleton instances, keyed by
 * fully-qualified class name. {@see Instantiator} is the only writer — it
 * caches an instance here after building it — and the sole reader that
 * checks for a cached instance before building again; this class holds no
 * reflection or building logic of its own.
 */
class InstanceStore implements ContainerInterface {

	/**
	 * The stored instances, keyed by class name.
	 *
	 * @var array<string, object>
	 */
	private array $instances = array();

	/**
	 * Returns the stored instance for the given class.
	 *
	 * @param string $id Fully-qualified class name to look up.
	 * @throws NotFoundException When no instance is stored for the class.
	 * @return object The stored instance.
	 */
	public function get( string $id ): mixed {
		if ( ! $this->has( $id ) ) {
			throw new NotFoundException(
				esc_html( sprintf( 'No instance was found for "%s".', $id ) )
			);
		}

		return $this->instances[ $id ];
	}

	/**
	 * Tells whether an instance is stored for the given class.
	 *
	 * @param string $id Fully-qualified class name to look up.
	 * @return bool Whether an instance is stored.
	 */
	public function has( string $id ): bool {
		return array_key_exists( $id, $this->instances );
	}

	/**
	 * Stores an instance under the given class name.
	 *
	 * @param string $id       Fully-qualified class name to store the instance under.
	 * @param object $instance The instance to store.
	 * @return void
	 */
	public function set( string $id, object $instance ): void {
		$this->instances[ $id ] = $instance;
	}
}
