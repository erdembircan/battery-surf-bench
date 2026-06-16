<?php
/**
 * Plugin path and URL resolver.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use function plugin_dir_path;
use function plugins_url;

defined( 'ABSPATH' ) || exit;

/**
 * Resolves filesystem paths and public URLs for assets shipped with the plugin.
 *
 * Constructed once with the main plugin file, it turns a path relative to the
 * plugin root into either an absolute filesystem path or a public URL, so
 * components never have to know where the plugin lives on disk or on the web.
 */
class Paths {

	/**
	 * Stores the plugin file the paths and URLs are resolved against.
	 *
	 * @param string $plugin_file Absolute path to the main plugin file.
	 */
	public function __construct( private string $plugin_file ) {
	}

	/**
	 * Resolves a plugin-relative path to its public URL.
	 *
	 * @param string $relative Path relative to the plugin root (e.g. `assets/app.js`).
	 * @return string The public URL of the resource.
	 */
	public function url( string $relative ): string {
		return plugins_url( $relative, $this->plugin_file );
	}

	/**
	 * Resolves a plugin-relative path to its absolute filesystem path.
	 *
	 * @param string $relative Path relative to the plugin root (e.g. `assets/app.js`).
	 * @return string The absolute filesystem path of the resource.
	 */
	public function path( string $relative ): string {
		return plugin_dir_path( $this->plugin_file ) . ltrim( $relative, '/' );
	}
}
