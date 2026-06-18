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
use function get_query_var;
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
 * The virtual post never touches the database: it exists only for the duration
 * of the request that asked for it.
 */
class CourseRouter implements Manager {

	/**
	 * Stores the catalog the pages come from and the query parameter that
	 * selects one.
	 *
	 * @param CourseCatalog $catalog    Source of the course pages and their markup.
	 * @param string        $param      Query parameter the page slug is read from.
	 * @param Assets        $assets     Service used to enqueue the course stylesheet.
	 * @param string        $stylesheet Course stylesheet, relative to the plugin root.
	 */
	public function __construct(
		private CourseCatalog $catalog,
		private string $param,
		private Assets $assets,
		private string $stylesheet
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
	 * parameter names a catalog page, so the theme renders it as a singular
	 * page. Runs on the main query only and leaves every other query untouched.
	 *
	 * @param array<int, WP_Post> $posts The posts the query found.
	 * @param WP_Query            $query The query being run.
	 * @return array<int, WP_Post> The course page's virtual post, or the posts unchanged.
	 */
	public function maybe_render( array $posts, WP_Query $query ): array {
		if ( ! $query->is_main_query() ) {
			return $posts;
		}

		$page = $this->catalog->find( $this->requested_slug() );

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
		// the page is wrapped in (and reaches nothing else on the page).
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_style' ) );

		return array( $virtual );
	}

	/**
	 * Enqueues the course stylesheet.
	 *
	 * @return void
	 */
	public function enqueue_style(): void {
		$this->assets->enqueue( $this->stylesheet );
	}
}
