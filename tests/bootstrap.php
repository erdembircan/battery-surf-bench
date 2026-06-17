<?php
/**
 * PHPUnit bootstrap.
 *
 * Defines the minimal WordPress constants the plugin guards against before
 * Brain Monkey takes over WordPress function mocking, then loads Composer's
 * autoloader.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

// Plugin source files bail with `defined( 'ABSPATH' ) || exit;`. Define it so
// classes can be autoloaded inside the test process without exiting.
if ( ! defined( 'ABSPATH' ) ) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Shimming a WordPress core constant for the test process.
	define( 'ABSPATH', sys_get_temp_dir() . '/wordpress/' );
}

if ( ! class_exists( 'WP_Query' ) ) {
	// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedClassFound -- Shimming a WordPress core class for the test process.
	/**
	 * Minimal WP_Query stub for the test process.
	 *
	 * Brain Monkey mocks functions, not classes, so code that instantiates
	 * WP_Query (e.g. the page seeder) needs a stand-in. It resolves to whatever
	 * post IDs a test stages in the static `$staged_posts`, defaulting to none,
	 * so a test can simulate a found or a missing page. The constructor ignores
	 * the query arguments the caller passes (PHP discards the extra arguments).
	 */
	class WP_Query {

		/**
		 * Post IDs the next query should resolve to.
		 *
		 * @var array<int, int>
		 */
		public static array $staged_posts = array();

		/**
		 * Posts matched by the query.
		 *
		 * @var array<int, int>
		 */
		public array $posts;

		/**
		 * Resolves the query to the staged posts.
		 */
		public function __construct() {
			$this->posts = self::$staged_posts;
		}
	}
	// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedClassFound
}

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
