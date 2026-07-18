<?php
/**
 * Asset enqueuing service.
 *
 * @package ErdemBircan\BatterySurfBench\Core
 */

namespace ErdemBircan\BatterySurfBench\Core;

use InvalidArgumentException;

use function esc_html;
use function wp_enqueue_script;
use function wp_enqueue_script_module;
use function wp_enqueue_style;
use function wp_localize_script;
use function wp_register_script;
use function wp_register_script_module;
use function wp_set_script_module_translations;
use function wp_set_script_translations;

defined( 'ABSPATH' ) || exit;

/**
 * The plugin's gateway for everything WordPress asset-related: enqueuing script
 * and style files, registering built bundles, attaching localized data to a
 * script, and enqueuing a registered handle.
 *
 * Keeping all of it behind this one service means no other component reaches for
 * the `wp_enqueue_*` / `wp_localize_script` functions directly — asset wiring is
 * this class's domain. For plugin-owned files it derives a namespaced handle and
 * versions the asset by hashing its contents, so the version changes exactly
 * when the file does: the browser never serves a stale asset and never
 * re-downloads an unchanged one, with no manual version bumps.
 */
class Assets {

	/**
	 * Stores the handle namespace and the path resolver.
	 *
	 * @param string $prefix Namespace prefix applied to every enqueued asset's handle.
	 * @param Paths  $paths  Resolver for asset URLs and filesystem paths.
	 */
	public function __construct( private string $prefix, private Paths $paths ) {
	}

	/**
	 * Enqueues a plugin-relative asset, choosing the script or style function
	 * by its file extension and versioning it with a content hash.
	 *
	 * @param string        $relative Path to the asset relative to the plugin root.
	 * @param array<string> $deps     Handles the asset depends on.
	 * @throws InvalidArgumentException When the file extension is not a supported asset type.
	 * @return string The namespaced handle the asset was enqueued under.
	 */
	public function enqueue( string $relative, array $deps = array() ): string {
		$handle    = $this->handle( $relative );
		$extension = strtolower( pathinfo( $relative, PATHINFO_EXTENSION ) );

		switch ( $extension ) {
			case 'js':
			case 'mjs':
				wp_enqueue_script( $handle, $this->paths->url( $relative ), $deps, $this->version( $relative ), true );
				break;
			case 'css':
				wp_enqueue_style( $handle, $this->paths->url( $relative ), $deps, $this->version( $relative ) );
				break;
			default:
				throw new InvalidArgumentException(
					esc_html( sprintf( 'Cannot enqueue "%s": unsupported asset type "%s".', $relative, $extension ) )
				);
		}

		return $handle;
	}

	/**
	 * Registers a script bundle built by `@wordpress/scripts`, wiring in the
	 * dependencies and version from the sibling `*.asset.php` the build emits.
	 *
	 * Registering rather than enqueuing returns the handle so the caller can
	 * attach localized data ({@see Assets::localize()}) before enqueuing it
	 * ({@see Assets::enqueue_script()}). Leaning on the generated manifest means
	 * the bundle always asks WordPress for the exact `wp-*` scripts it
	 * externalized — `wp-element`, `wp-data`, `wp-core-data`, … — instead of a
	 * hand-maintained dependency list.
	 *
	 * @param string $relative Path to the built script relative to the plugin root.
	 * @return string The registered script's handle.
	 */
	public function register_bundle( string $relative ): string {
		$handle   = $this->handle( $relative );
		$manifest = $this->manifest( $relative );

		wp_register_script(
			$handle,
			$this->paths->url( $relative ),
			$manifest['dependencies'],
			$manifest['version'],
			true
		);

		return $handle;
	}

	/**
	 * Registers a script module built by the Interactivity module bundler,
	 * versioned by content hash like every other plugin-owned asset. Registering
	 * rather than enqueuing lets a caller register its translations
	 * ({@see Assets::set_script_module_translations()}) before marking it for
	 * output ({@see Assets::enqueue_script_module()}).
	 *
	 * @param string        $relative Path to the built module relative to the plugin root.
	 * @param array<string> $deps     Script module identifiers this module depends on.
	 * @return string The registered module's identifier.
	 */
	public function register_script_module( string $relative, array $deps = array() ): string {
		$id = $this->handle( $relative );

		wp_register_script_module( $id, $this->paths->url( $relative ), $deps, $this->version( $relative ) );

		return $id;
	}

	/**
	 * Marks an already-registered script module for output, the script-module
	 * counterpart of {@see Assets::enqueue_script()}.
	 *
	 * @param string $id Identifier of a registered script module.
	 * @return void
	 */
	public function enqueue_script_module( string $id ): void {
		wp_enqueue_script_module( $id );
	}

	/**
	 * Attaches a data object to a registered script as a JavaScript global, the
	 * canonical way to hand server-side data to a front-end bundle. Passing data
	 * to scripts is part of asset wiring, so it lives here rather than callers
	 * reaching for `wp_localize_script` themselves.
	 *
	 * @param string              $handle      Handle of a registered script.
	 * @param string              $object_name Name of the JavaScript global the data is exposed as.
	 * @param array<string,mixed> $data        Data to expose to the script.
	 * @return void
	 */
	public function localize( string $handle, string $object_name, array $data ): void {
		wp_localize_script( $handle, $object_name, $data );
	}

	/**
	 * Enqueues an already-registered script by its handle, so the registration,
	 * localization and enqueue steps of a bundle all pass through this service.
	 *
	 * @param string $handle Handle of a registered script.
	 * @return void
	 */
	public function enqueue_script( string $handle ): void {
		wp_enqueue_script( $handle );
	}

	/**
	 * Registers the plugin's JavaScript translations for a classic script,
	 * so its `@wordpress/i18n` strings localize. WordPress loads the matching
	 * translation JSON from the plugin's bundled `languages` directory before the
	 * script runs; the script must declare `wp-i18n` as a dependency, which the
	 * build manifest already does for any bundle that imports `@wordpress/i18n`.
	 *
	 * The handle namespace doubles as the text domain — both are the plugin's
	 * `battery-surf-bench` slug — so the service already knows which domain to
	 * register, just as it owns the path the translations load from.
	 *
	 * @param string $handle Handle of a registered script.
	 * @return void
	 */
	public function set_script_translations( string $handle ): void {
		wp_set_script_translations( $handle, $this->prefix, $this->paths->path( 'languages' ) );
	}

	/**
	 * Registers the plugin's JavaScript translations for a script module, the
	 * Interactivity API counterpart of {@see Assets::set_script_translations()}.
	 * Script modules localize through this dedicated API (WordPress 7.0+); the
	 * classic {@see Assets::set_script_translations()} does not reach them.
	 * WordPress prints the module's `wp.i18n.setLocaleData()` call from the same
	 * bundled `languages` directory before the module executes.
	 *
	 * @param string $id Identifier of a registered script module.
	 * @return void
	 */
	public function set_script_module_translations( string $id ): void {
		wp_set_script_module_translations( $id, $this->prefix, $this->paths->path( 'languages' ) );
	}

	/**
	 * Reads the dependency manifest `@wordpress/scripts` writes beside a built
	 * script, falling back to no dependencies and a content-hash version when it
	 * is missing.
	 *
	 * @param string $relative Path to the built script relative to the plugin root.
	 * @return array{dependencies: array<int, string>, version: string|false} The bundle's dependencies and version.
	 */
	private function manifest( string $relative ): array {
		$asset_path = preg_replace( '/\.js$/', '.asset.php', $this->paths->path( $relative ) );

		$manifest = is_string( $asset_path ) && is_readable( $asset_path ) ? require $asset_path : array();

		return array(
			'dependencies' => is_array( $manifest['dependencies'] ?? null ) ? $manifest['dependencies'] : array(),
			'version'      => is_string( $manifest['version'] ?? null ) ? $manifest['version'] : $this->version( $relative ),
		);
	}

	/**
	 * Builds the namespaced handle for an asset from its file name.
	 *
	 * @param string $relative Path to the asset relative to the plugin root.
	 * @return string The namespaced handle.
	 */
	private function handle( string $relative ): string {
		return $this->prefix . '-' . pathinfo( $relative, PATHINFO_FILENAME );
	}

	/**
	 * Hashes the asset's contents to a version string, so the version tracks
	 * the file rather than a hand-maintained number.
	 *
	 * @param string $relative Path to the asset relative to the plugin root.
	 * @return string|false The content hash, or false when the file is unreadable.
	 */
	private function version( string $relative ): string|false {
		return hash_file( 'crc32b', $this->paths->path( $relative ) );
	}
}
