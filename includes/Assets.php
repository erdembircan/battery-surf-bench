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
	 * Namespace prefix applied to every enqueued asset's handle.
	 *
	 * @var string
	 */
	private string $prefix;

	/**
	 * Resolver for the asset's public URL and filesystem path.
	 *
	 * @var Paths
	 */
	private Paths $paths;

	/**
	 * Stores the handle namespace and the path resolver.
	 *
	 * @param string $prefix Namespace prefix applied to every enqueued asset's handle.
	 * @param Paths  $paths  Resolver for asset URLs and filesystem paths.
	 */
	public function __construct( string $prefix, Paths $paths ) {
		$this->prefix = $prefix;
		$this->paths  = $paths;
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
