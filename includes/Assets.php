<?php
/**
 * Asset enqueuing service.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use InvalidArgumentException;

use function esc_html;
use function wp_enqueue_script;
use function wp_enqueue_style;
use function wp_register_script;

defined( 'ABSPATH' ) || exit;

/**
 * Enqueues the plugin's script and style files.
 *
 * Components hand it a plugin-relative asset path; it derives a namespaced
 * handle, picks the right WordPress enqueue function from the file extension,
 * and versions the asset by hashing its contents. Content hashing means the
 * version changes exactly when the file does, so the browser never serves a
 * stale asset and never re-downloads an unchanged one — no manual version
 * bumps, and no cache headaches during development.
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
	 * @return void
	 */
	public function enqueue( string $relative, array $deps = array() ): void {
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
	}

	/**
	 * Registers a script bundle built by `@wordpress/scripts`, wiring in the
	 * dependencies and version from the sibling `*.asset.php` the build emits.
	 *
	 * Registering rather than enqueuing returns the handle so the caller can
	 * attach localized data before the bundle runs; the caller enqueues it once
	 * that data is in place. Leaning on the generated manifest means the bundle
	 * always asks WordPress for the exact `wp-*` scripts it externalized — most
	 * importantly `wp-dataviews` — instead of a hand-maintained dependency list.
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
