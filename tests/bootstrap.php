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

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedClassFound -- Shimming WordPress core classes for the test process.
// phpcs:disable Generic.Files.OneObjectStructurePerFile.MultipleFound -- Both WP core stubs belong with the test bootstrap.
if ( ! class_exists( 'WP_Query' ) ) {
	/**
	 * Minimal WP_Query stub for the test process.
	 *
	 * Brain Monkey mocks functions, not classes, so code that type-hints or
	 * mutates WP_Query (e.g. the course router) needs a stand-in. `is_main_query`
	 * is controllable via `$is_main`, and dynamic properties are allowed so the
	 * router can set the query flags it would on a real query.
	 */
	#[\AllowDynamicProperties]
	class WP_Query {

		/**
		 * Whether this stands in for the main query.
		 *
		 * @var bool
		 */
		public bool $is_main = true;

		/**
		 * Reports whether this is the main query.
		 *
		 * @return bool The staged main-query flag.
		 */
		public function is_main_query(): bool {
			return $this->is_main;
		}
	}
}

if ( ! class_exists( 'WP_Post' ) ) {
	/**
	 * Minimal WP_Post stub: copies the given data object's fields onto itself,
	 * matching how WordPress builds a post from a raw row.
	 */
	#[\AllowDynamicProperties]
	class WP_Post {

		/**
		 * Copies each field of the data object onto the post.
		 *
		 * @param object $post Raw post data.
		 */
		public function __construct( object $post ) {
			foreach ( get_object_vars( $post ) as $key => $value ) {
				$this->$key = $value;
			}
		}
	}
}
// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedClassFound
// phpcs:enable Generic.Files.OneObjectStructurePerFile.MultipleFound

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
