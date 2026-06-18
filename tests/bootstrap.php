<?php
/**
 * PHPUnit bootstrap.
 *
 * Defines the minimal WordPress class stubs the plugin type-hints against or
 * instantiates, installs an in-memory filesystem double, then loads Composer's
 * autoloader. `ABSPATH` — which the plugin's `defined( 'ABSPATH' ) || exit`
 * guards check — is defined in `phpunit.xml.dist` (`<php><const>`), so it is in
 * place before any plugin class autoloads, without a non-prefixed `define()`
 * here.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

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

if ( ! class_exists( 'WP_Filesystem_Base' ) ) {
	/**
	 * In-memory stand-in for WordPress's filesystem abstraction. It touches no
	 * disk: every path reports as present and reads back fixed block markup, so
	 * code that loads bundled files through `$wp_filesystem` can be exercised
	 * without real files. Tests needing other behaviour install a subclass.
	 * Code resolves the filesystem via the `$wp_filesystem` global and
	 * type-checks it against this class, so the stub carries the real class name.
	 */
	class WP_Filesystem_Base {

		/**
		 * Reports whether a path exists. The in-memory double has every file.
		 *
		 * @param string $path Path to test.
		 * @return bool Always true.
		 */
		public function exists( $path ): bool {
			return true;
		}

		/**
		 * Reads a file's contents — fixed block markup, never the disk.
		 *
		 * @param string $file Path to read.
		 * @return string The stand-in block markup.
		 */
		public function get_contents( $file ) {
			return '<!-- wp:paragraph --><p>Bundled course markup.</p><!-- /wp:paragraph -->';
		}
	}
}

if ( ! class_exists( 'WP_Styles' ) ) {
	/**
	 * Minimal WP_Styles stub exposing the `$queue` the cockpit's asset strip
	 * iterates over to dequeue registered styles.
	 */
	#[\AllowDynamicProperties]
	class WP_Styles {

		/**
		 * Handles currently enqueued.
		 *
		 * @var array<int, string>
		 */
		public array $queue = array();
	}
}

if ( ! class_exists( 'WP_Scripts' ) ) {
	/**
	 * Minimal WP_Scripts stub exposing the `$queue` the cockpit's asset strip
	 * iterates over to dequeue registered scripts.
	 */
	#[\AllowDynamicProperties]
	class WP_Scripts {

		/**
		 * Handles currently enqueued.
		 *
		 * @var array<int, string>
		 */
		public array $queue = array();
	}
}

// Install the in-memory filesystem double as the WordPress filesystem global so
// code reading bundled files through the abstraction never reaches the disk.
$GLOBALS['wp_filesystem'] = new WP_Filesystem_Base();

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
