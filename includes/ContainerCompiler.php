<?php
/**
 * Build-time container-definition token flattener.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use function is_array;
use function is_string;
use function str_ends_with;
use function str_starts_with;
use function trim;

defined( 'ABSPATH' ) || exit;

/**
 * Pre-resolves every `%token%` config-lookup string in a service-recipe map
 * to its literal {@see Registry} value, so a build step can produce a
 * compiled definitions array the runtime loads without resolving tokens
 * against the registry at boot. Everything else in the recipes — class-FQCN
 * strings, `runtime`/`services`/`csv`/`path` wrapper keys, scalars — is left
 * byte-for-byte identical; only `%token%` leaves are rewritten.
 *
 * This class performs no file I/O: it is a pure transform over the array
 * `Services.php` returns, exercised directly by its own tests. Writing the
 * flattened result to disk is `bin/CompileContainer.php`'s job, not this
 * class's.
 */
class ContainerCompiler {

	/**
	 * Returns a deep copy of the given service recipes with every `%token%`
	 * leaf replaced by its resolved value from the registry.
	 *
	 * @param array<string, mixed> $services The service-recipe map to flatten.
	 * @param Registry             $registry Source of the config values `%token%` leaves resolve against.
	 * @return array<string, mixed> The flattened recipe map.
	 */
	public function compile( array $services, Registry $registry ): array {
		return $this->flatten( $services, $registry );
	}

	/**
	 * Recursively walks a value, replacing every `%token%` string leaf with
	 * its resolved registry value and rebuilding arrays with their keys
	 * preserved. Anything else — a class-FQCN string, a scalar, a wrapper's
	 * non-token contents — is returned unchanged.
	 *
	 * @param mixed    $value    The value to flatten.
	 * @param Registry $registry Source of the config values `%token%` leaves resolve against.
	 * @return mixed The flattened value.
	 */
	private function flatten( mixed $value, Registry $registry ): mixed {
		if ( is_array( $value ) ) {
			$flattened = array();

			foreach ( $value as $key => $item ) {
				$flattened[ $key ] = $this->flatten( $item, $registry );
			}

			return $flattened;
		}

		if ( is_string( $value ) && str_starts_with( $value, '%' ) && str_ends_with( $value, '%' ) ) {
			return $registry->get( trim( $value, '%' ) );
		}

		return $value;
	}
}
