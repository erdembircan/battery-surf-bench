<?php
/**
 * Service-recipe container.
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
 * An immutable PSR-11 container holding the plugin's service-recipe map: the
 * array {@see Instantiator} consults to know how to build each class it is
 * asked to build. Identifiers are fully-qualified class names; a recipe is a
 * plain array describing constructor argument specs and sharing behaviour —
 * see `Services.php`, this container's data source, for the recipe shape.
 *
 * Reflection lives entirely in {@see Instantiator}; this class is pure
 * PSR-11 storage, deliberately kept out of the reflection domain.
 */
class Definitions implements ContainerInterface {

	/**
	 * Stores the recipe map. The container is immutable from here on.
	 *
	 * @param array<string, array<string, mixed>> $definitions Recipe map keyed by fully-qualified class name.
	 */
	public function __construct( private array $definitions ) {
	}

	/**
	 * Returns the recipe stored for the given class.
	 *
	 * @param string $id Fully-qualified class name to look up.
	 * @throws NotFoundException When no recipe is registered for the class.
	 * @return array<string, mixed> The class's recipe.
	 */
	public function get( string $id ): mixed {
		if ( ! $this->has( $id ) ) {
			throw new NotFoundException(
				esc_html( sprintf( 'No service definition was found for "%s".', $id ) )
			);
		}

		return $this->definitions[ $id ];
	}

	/**
	 * Tells whether a recipe is registered for the given class.
	 *
	 * @param string $id Fully-qualified class name to look up.
	 * @return bool Whether a recipe exists.
	 */
	public function has( string $id ): bool {
		return array_key_exists( $id, $this->definitions );
	}
}
