<?php
/**
 * Translation loader.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Support\Manager;

use function add_action;
use function dirname;
use function load_plugin_textdomain;
use function plugin_basename;

defined( 'ABSPATH' ) || exit;

/**
 * Loads the plugin's PHP translations.
 *
 * The plugin ships its own translations under `/languages`, so the
 * `battery-surf-bench` text domain is pointed there explicitly rather than left
 * to the just-in-time loader, which only searches the global language
 * directory. Loading is hooked onto `init` — the earliest point WordPress
 * permits translations since 6.7, which raises a `_doing_it_wrong` notice for
 * any domain triggered before it.
 *
 * This covers PHP strings only; the JavaScript bundles register their own
 * translations through {@see Assets::set_script_translations()} and
 * {@see Assets::set_script_module_translations()}.
 */
class I18n implements Manager {

	/**
	 * Stores the text domain and the plugin file its languages directory is
	 * resolved against.
	 *
	 * @param string $domain      Text domain the plugin's strings are registered under.
	 * @param string $plugin_file Absolute path to the main plugin file.
	 */
	public function __construct( private string $domain, private string $plugin_file ) {
	}

	/**
	 * Hooks translation loading onto `init`.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'load_textdomain' ) );
	}

	/**
	 * Loads the plugin's translations from its bundled `/languages` directory.
	 *
	 * @return void
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain(
			$this->domain,
			false,
			dirname( plugin_basename( $this->plugin_file ) ) . '/languages'
		);
	}
}
