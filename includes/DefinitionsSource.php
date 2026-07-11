<?php
/**
 * Compiled-vs-live container definitions source gate.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use function in_array;

defined( 'ABSPATH' ) || exit;

/**
 * Decides whether the bootstrap should load the build-time compiled
 * container definitions in place of the live `Services.php`.
 *
 * A stale compiled artifact left on disk in a development environment would
 * otherwise be read silently, so edits to `Services.php` would appear to do
 * nothing — the compiled definitions are only ever preferred outside a
 * development environment, gated the same way {@see \ErdemBircan\BatterySurfBench\DevTools\DevTools::is_active()}
 * gates itself against `wp_get_environment_type()`.
 *
 * This class performs no file I/O and calls no WordPress function itself:
 * the caller resolves `wp_get_environment_type()` and `is_readable()` and
 * passes both in, so the decision stays a pure, unit-testable function.
 */
class DefinitionsSource {

	/**
	 * Tells whether the compiled definitions should be preferred over the
	 * live `Services.php`.
	 *
	 * Because this is an allowlist of dev environments rather than a
	 * denylist of production-like ones, an environment not in
	 * `$dev_environments` — including an unrecognized or misconfigured one —
	 * fails safe to the compiled/production path instead of a stale live one.
	 *
	 * @param string             $environment       The current environment (from `wp_get_environment_type()`).
	 * @param array<int, string> $dev_environments  Environments in which the live source is always used.
	 * @param bool               $compiled_readable Whether the compiled artifact exists and is readable.
	 * @return bool Whether to prefer the compiled definitions.
	 */
	public function prefers_compiled( string $environment, array $dev_environments, bool $compiled_readable ): bool {
		return $compiled_readable && ! in_array( $environment, $dev_environments, true );
	}
}
