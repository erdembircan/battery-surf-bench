<?php
/**
 * Course page front-end router.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Support\Manager;
use WP_Post;
use WP_Query;

use function __return_empty_string;
use function add_action;
use function add_filter;
use function get_option;
use function get_post;
use function get_query_var;
use function get_the_title;
use function in_array;
use function preg_match;
use function sanitize_key;

defined( 'ABSPATH' ) || exit;

/**
 * Serves the course pages off a URL parameter instead of seeding real pages.
 * When the request carries the course query parameter (e.g.
 * `?bsbSessionPage=article-1`) and the slug names a catalog page, the router
 * injects that page's block markup as a virtual post and lets WordPress render
 * it through the active theme — full header, footer, scripts and styles, with
 * `the_content` running `do_blocks()` on the markup. Nothing is seeded and no
 * theme output is stripped, so a course page reflects the theme exactly as any
 * real page would.
 *
 * A slug of the form `user-<id>` is served the same way, but its content comes
 * from a real, user-selected post rather than the bundled catalog — see
 * {@see resolve_user_page()}. This is a deliberate security boundary: the surf
 * engine (`surfer.js` + the shared course-page body class) is enqueued only
 * for a request the router itself serves through this synthetic-render path.
 * It is never enqueued on a user page's own real permalink, and a `user-<id>`
 * slug is only ever served when that id is currently selected and eligible in
 * the saved surf-course order — checked here, server-side, against the saved
 * option. Nothing in the URL (in particular, never the `bsbTraits` behavior
 * parameter) is allowed to decide whether a page is a surf target.
 *
 * The virtual post never touches the database: it exists only for the duration
 * of the request that asked for it.
 */
class CourseRouter implements Manager {

	/**
	 * Stores the catalog the pages come from and the query parameter that
	 * selects one.
	 *
	 * @param CourseCatalog        $catalog         Source of the bundled course pages and their markup.
	 * @param string               $param           Query parameter the page slug is read from.
	 * @param Assets               $assets          Service used to enqueue the course stylesheet and surf engine.
	 * @param string               $stylesheet      Course stylesheet, relative to the plugin root.
	 * @param string               $script          Surf engine script, relative to the plugin root.
	 * @param string               $body_class      Body-class marker stamped on every served course page.
	 * @param string               $option_name     Name of the option the surf-course order is saved under — the authoritative, server-side source of which `user-<id>` slugs are eligible to be served.
	 * @param CourseOrderSanitizer $order_sanitizer Heals the saved order on every read and exposes the currently-selected user ids to gate a `user-<id>` request against.
	 */
	public function __construct(
		private CourseCatalog $catalog,
		private string $param,
		private Assets $assets,
		private string $stylesheet,
		private string $script,
		private string $body_class,
		private string $option_name,
		private CourseOrderSanitizer $order_sanitizer
	) {
	}

	/**
	 * Registers the course query parameter and the main-query interceptor.
	 *
	 * @return void
	 */
	public function register(): void {
		add_filter( 'query_vars', array( $this, 'add_query_var' ) );
		add_filter( 'the_posts', array( $this, 'maybe_render' ), 10, 2 );
	}

	/**
	 * Declares the course query parameter so WordPress parses it off the URL.
	 *
	 * @param array<int, string> $vars Registered public query vars.
	 * @return array<int, string> The query vars with the course parameter added.
	 */
	public function add_query_var( array $vars ): array {
		$vars[] = $this->param;

		return $vars;
	}

	/**
	 * Turns the main query into the requested course page when the course
	 * parameter names either a bundled catalog page or a currently-selected,
	 * eligible user page, so the theme renders it as a singular page. Runs on
	 * the main query only and leaves every other query untouched — including a
	 * `user-<id>` slug that does not (or no longer) name a selected page, which
	 * falls through to whatever the site would otherwise resolve (ordinarily a
	 * 404).
	 *
	 * @param array<int, WP_Post> $posts The posts the query found.
	 * @param WP_Query            $query The query being run.
	 * @return array<int, WP_Post> The course page's virtual post, or the posts unchanged.
	 */
	public function maybe_render( array $posts, WP_Query $query ): array {
		if ( ! $query->is_main_query() ) {
			return $posts;
		}

		$slug = $this->requested_slug();
		$page = $this->catalog->find( $slug ) ?? $this->resolve_user_page( $slug );

		if ( null === $page ) {
			return $posts;
		}

		return $this->serve( $query, $page );
	}

	/**
	 * Resolves the requested course slug from the registered query parameter.
	 * The parameter is a public query var ({@see CourseRouter::add_query_var()}),
	 * so WordPress parses it off the URL and exposes it through `get_query_var()`
	 * — no need to read the superglobal.
	 *
	 * @return string The sanitized slug, or '' when the parameter is absent.
	 */
	private function requested_slug(): string {
		return sanitize_key( (string) get_query_var( $this->param ) );
	}

	/**
	 * Resolves a `user-<id>` slug to the real post it names, but only when
	 * that id is currently selected and eligible in the saved surf-course
	 * order — the authoritative, server-side gate. This is the ONLY check that
	 * decides whether a user page is served: nothing about the request itself
	 * (in particular, never the `bsbTraits` behavior parameter) has any say.
	 * A slug that does not match the pattern, an id absent from the saved
	 * order, or an id that no longer resolves to a post all fail identically.
	 *
	 * The returned page's content is the real post's own raw block markup, so
	 * it renders — and enqueues its blocks' own view assets — through the
	 * exact same `the_content` / `do_blocks()` path {@see serve()} already
	 * runs bundled pages through.
	 *
	 * @param string $slug The requested slug.
	 * @return CoursePage|null The resolved user page, or null when the slug does not name a currently-selected, eligible user page.
	 */
	private function resolve_user_page( string $slug ): ?CoursePage {
		if ( 1 !== preg_match( '/^user-(\d+)$/', $slug, $matches ) ) {
			return null;
		}

		$id = (int) $matches[1];

		if ( ! in_array( $id, $this->eligible_user_ids(), true ) ) {
			return null;
		}

		$post = get_post( $id );

		if ( null === $post ) {
			return null;
		}

		return new CoursePage( $slug, get_the_title( $id ), $post->post_content );
	}

	/**
	 * Reads and heals the saved surf-course order, then extracts the set of
	 * user post ids it names — the same set {@see CourseLibrary} emits router
	 * links for. The saved option is the single source of truth for which
	 * `user-<id>` slugs this router will serve.
	 *
	 * @return array<int, int> The saved order's user post ids.
	 */
	private function eligible_user_ids(): array {
		$order = $this->order_sanitizer->sanitize( get_option( $this->option_name, $this->order_sanitizer->default_order() ) );
		$ids   = array();

		foreach ( $order as $entry ) {
			if ( 'user' === $entry['kind'] ) {
				$ids[] = $entry['id'];
			}
		}

		return $ids;
	}

	/**
	 * Builds a single virtual page carrying the course page's markup and flags
	 * the query as a singular page so the theme's page template renders it. The
	 * post is synthesized in memory only and never reaches the database.
	 *
	 * @param WP_Query   $query The main query to take over.
	 * @param CoursePage $page  The course page to render.
	 * @return array<int, WP_Post> The virtual post for the query to render.
	 */
	private function serve( WP_Query $query, CoursePage $page ): array {
		$virtual = new WP_Post(
			(object) array(
				'ID'             => 0,
				'post_author'    => 0,
				'post_title'     => $page->title(),
				'post_name'      => $page->slug(),
				'post_content'   => $page->content(),
				'post_type'      => 'page',
				'post_status'    => 'publish',
				'comment_status' => 'closed',
				'ping_status'    => 'closed',
				'filter'         => 'raw',
			)
		);

		$query->queried_object    = $virtual;
		$query->queried_object_id = 0;
		$query->post_count        = 1;
		$query->found_posts       = 1;
		$query->max_num_pages     = 1;
		$query->is_singular       = true;
		$query->is_page           = true;
		$query->is_single         = false;
		$query->is_home           = false;
		$query->is_front_page     = false;
		$query->is_archive        = false;
		$query->is_404            = false;

		// The article's headline lives in the content (the editorial `<h1>`), so
		// suppress the theme's own post-title block to avoid a duplicate title.
		// The post title is left intact for the document `<title>` element.
		add_filter( 'render_block_core/post-title', '__return_empty_string' );

		// Load the course stylesheet, which styles the `.bsb-course-content`
		// the page is wrapped in (and reaches nothing else on the page), and the
		// headless surf engine, which boots itself only when the traits URL
		// param is present.
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_style' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_script' ) );

		// Mark the rendered page so the cockpit's viewport load guard can tell a
		// successfully served course page from a 404 (or any other page loaded in
		// the iframe) from inside the frame. The marker rides the body class, not
		// each page's own content markup, so it is guaranteed on every course page
		// regardless of what that page's blocks look like.
		add_filter( 'body_class', array( $this, 'mark_course_body' ) );

		return array( $virtual );
	}

	/**
	 * Appends the course-page marker to the body classes so the viewport load
	 * guard can recognize a served course page from inside the iframe. Added only
	 * while serving a course page, so a 404 or any non-course page never carries
	 * it.
	 *
	 * @param array<int, string> $classes The body classes WordPress assembled.
	 * @return array<int, string> The classes with the course-page marker appended.
	 */
	public function mark_course_body( array $classes ): array {
		$classes[] = $this->body_class;

		return $classes;
	}

	/**
	 * Enqueues the course stylesheet.
	 *
	 * @return void
	 */
	public function enqueue_style(): void {
		$this->assets->enqueue( $this->stylesheet );
	}

	/**
	 * Enqueues the surf engine script.
	 *
	 * @return void
	 */
	public function enqueue_script(): void {
		$this->assets->enqueue( $this->script );
	}
}
