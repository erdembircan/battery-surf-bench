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

if ( ! class_exists( 'WP_REST_Request' ) ) {
	/**
	 * Minimal WP_REST_Request stub: records the query params set on it so a
	 * test can assert what an internal REST dispatch (e.g. the settings
	 * screen's seeded Browse query) actually queried, without a real REST
	 * server. `rest_do_request()` itself is a plain function Brain Monkey
	 * mocks directly, so this stub only needs to satisfy code that builds and
	 * populates a request object.
	 */
	class WP_REST_Request {

		/**
		 * The params set on this request via `set_query_params()`.
		 *
		 * @var array<string, mixed>
		 */
		private array $query_params = array();

		/**
		 * Stores the request's method and route.
		 *
		 * @param string $method HTTP method, e.g. `GET`.
		 * @param string $route  REST route, e.g. `/wp/v2/search`.
		 */
		public function __construct( private string $method = 'GET', private string $route = '' ) {
		}

		/**
		 * Stores the given query params, replacing any set previously.
		 *
		 * @param array<string, mixed> $params The query params to set.
		 * @return void
		 */
		public function set_query_params( array $params ): void {
			$this->query_params = $params;
		}

		/**
		 * Returns the query params set on this request.
		 *
		 * @return array<string, mixed> The stored query params.
		 */
		public function get_query_params(): array {
			return $this->query_params;
		}

		/**
		 * Returns the HTTP method this request was built with.
		 *
		 * @return string The request method.
		 */
		public function get_method(): string {
			return $this->method;
		}

		/**
		 * Returns the route this request was built with.
		 *
		 * @return string The request route.
		 */
		public function get_route(): string {
			return $this->route;
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

if ( ! class_exists( 'WP_REST_Posts_Controller' ) ) {
	/**
	 * Minimal stub standing in for core's posts controller so a subclass can
	 * be constructed and its parent read-permission methods invoked in the
	 * test process; both grant access, matching core's default view-context
	 * behaviour, so a subclass override is what the tests actually exercise.
	 */
	#[\AllowDynamicProperties]
	class WP_REST_Posts_Controller {

		/**
		 * The post type slug this controller serves.
		 *
		 * @var string
		 */
		protected $post_type;

		/**
		 * Records the post type slug, as core's constructor does.
		 *
		 * @param string $post_type The post type slug.
		 */
		public function __construct( $post_type = '' ) {
			$this->post_type = $post_type;
		}

		/**
		 * Core's permissive default: a collection read is allowed.
		 *
		 * @param mixed $request The request.
		 * @return bool Always true.
		 */
		public function get_items_permissions_check( $request ) {
			return true;
		}

		/**
		 * Core's permissive default: a single-item read is allowed.
		 *
		 * @param mixed $request The request.
		 * @return bool Always true.
		 */
		public function get_item_permissions_check( $request ) {
			return true;
		}
	}
}

if ( ! class_exists( 'WP_Error' ) ) {
	/**
	 * Minimal stand-in for core's WP_Error capturing the code, message and
	 * data a returned REST error carries, so tests can assert the refusal
	 * shape without loading WordPress.
	 */
	#[\AllowDynamicProperties]
	class WP_Error {

		/**
		 * Stores the error code, message and data.
		 *
		 * @param string $code    Error code.
		 * @param string $message Human-readable message.
		 * @param mixed  $data    Associated data (e.g. an HTTP status array).
		 */
		public function __construct( private string $code = '', private string $message = '', private $data = '' ) {
		}

		/**
		 * The error code.
		 *
		 * @return string The code.
		 */
		public function get_error_code(): string {
			return $this->code;
		}

		/**
		 * The error message.
		 *
		 * @return string The message.
		 */
		public function get_error_message(): string {
			return $this->message;
		}

		/**
		 * The error data.
		 *
		 * @return mixed The data.
		 */
		public function get_error_data() {
			return $this->data;
		}
	}
}

if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
	/**
	 * Minimal WP_HTML_Tag_Processor stub covering the subset
	 * {@see \ErdemBircan\BatterySurfBench\Course\YouTubeEmbed} uses: walking
	 * to the next tag matching a given tag name, and getting/setting a
	 * simple double-quoted attribute's value. Not a general-purpose HTML
	 * parser — real WordPress core ships the full implementation the plugin
	 * runs against in production; this only needs to behave correctly for
	 * the single-attribute-on-an-iframe edits the normalizer performs,
	 * including leaving `get_updated_html()` identical to the original
	 * string when nothing was actually modified (the normalizer's
	 * idempotency guarantee).
	 */
	class WP_HTML_Tag_Processor {

		/**
		 * The original, unmodified HTML — returned by `get_updated_html()`
		 * when nothing was changed.
		 *
		 * @var string
		 */
		private string $original_html;

		/**
		 * The working HTML, mutated in place as attributes are set.
		 *
		 * @var string
		 */
		private string $html;

		/**
		 * Whether any attribute has been set since construction.
		 *
		 * @var bool
		 */
		private bool $modified = false;

		/**
		 * Offset to resume scanning from on the next `next_tag()` call.
		 *
		 * @var int
		 */
		private int $cursor = 0;

		/**
		 * Byte offset of the current tag's `<` in `$html`, or -1 before the
		 * first successful `next_tag()`.
		 *
		 * @var int
		 */
		private int $tag_start = -1;

		/**
		 * Byte offset just past the current tag's `>` in `$html`.
		 *
		 * @var int
		 */
		private int $tag_end = -1;

		/**
		 * Stores the HTML to process.
		 *
		 * @param string $html The HTML to walk.
		 */
		public function __construct( string $html ) {
			$this->original_html = $html;
			$this->html          = $html;
		}

		/**
		 * Advances to the next tag matching the query, a plain tag name (this
		 * stub only supports that form).
		 *
		 * @param string|array<string, mixed>|null $query Tag name to match, or null to match any tag.
		 * @return bool Whether a matching tag was found.
		 */
		public function next_tag( $query = null ): bool {
			$tag_name = is_string( $query ) ? $query : ( is_array( $query ) ? ( $query['tag_name'] ?? null ) : null );

			while ( preg_match( '/<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/s', $this->html, $matches, PREG_OFFSET_CAPTURE, $this->cursor ) ) {
				$name         = $matches[1][0];
				$start        = $matches[0][1];
				$end          = $start + strlen( $matches[0][0] );
				$this->cursor = $end;

				if ( null === $tag_name || 0 === strcasecmp( $name, $tag_name ) ) {
					$this->tag_start = $start;
					$this->tag_end   = $end;

					return true;
				}
			}

			return false;
		}

		/**
		 * Reads a simple double-quoted attribute's value off the current tag.
		 *
		 * @param string $name Attribute name.
		 * @return string|null The attribute's value, or null when absent or no tag is current.
		 */
		public function get_attribute( string $name ) {
			if ( $this->tag_start < 0 ) {
				return null;
			}

			$tag = substr( $this->html, $this->tag_start, $this->tag_end - $this->tag_start );

			if ( preg_match( '/\b' . preg_quote( $name, '/' ) . '\s*=\s*"([^"]*)"/i', $tag, $matches ) ) {
				return htmlspecialchars_decode( $matches[1] );
			}

			return null;
		}

		/**
		 * Sets (adding or replacing) a simple double-quoted attribute on the
		 * current tag. Mirrors real core's own behavior for a URI-bearing
		 * attribute (`src` among them): the value is expected RAW/unescaped
		 * and this method does the escaping itself (via `esc_url()`) — a
		 * caller that pre-escapes before calling this double-escapes, in
		 * both this stub and the real WP_HTML_Tag_Processor it stands in
		 * for.
		 *
		 * @param string $name  Attribute name.
		 * @param mixed  $value Attribute value.
		 * @return bool Whether the attribute was set.
		 */
		public function set_attribute( string $name, $value ): bool {
			if ( $this->tag_start < 0 ) {
				return false;
			}

			$tag     = substr( $this->html, $this->tag_start, $this->tag_end - $this->tag_start );
			$escaped = 'src' === strtolower( $name )
				? esc_url( (string) $value )
				: htmlspecialchars( (string) $value, ENT_QUOTES );
			$pattern = '/\b' . preg_quote( $name, '/' ) . '\s*=\s*"[^"]*"/i';

			$new_tag = preg_match( $pattern, $tag )
				? preg_replace( $pattern, $name . '="' . $escaped . '"', $tag, 1 )
				: preg_replace( '/\s*(\/)?>$/', ' ' . $name . '="' . $escaped . '"$1>', $tag, 1 );

			$this->html     = substr( $this->html, 0, $this->tag_start ) . $new_tag . substr( $this->html, $this->tag_end );
			$delta          = strlen( $new_tag ) - strlen( $tag );
			$this->tag_end += $delta;
			$this->cursor  += $delta;
			$this->modified = true;

			return true;
		}

		/**
		 * Returns the HTML with every set attribute applied, or the original,
		 * untouched string when nothing was ever set.
		 *
		 * @return string The updated (or original) HTML.
		 */
		public function get_updated_html(): string {
			return $this->modified ? $this->html : $this->original_html;
		}
	}
}

// Install the in-memory filesystem double as the WordPress filesystem global so
// code reading bundled files through the abstraction never reaches the disk.
$GLOBALS['wp_filesystem'] = new WP_Filesystem_Base();

require_once dirname( __DIR__ ) . '/vendor/autoload.php';
