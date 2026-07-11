<?php
/**
 * Course page front-end router.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Course\Views\UserPageView;
use ErdemBircan\BatterySurfBench\Support\Manager;
use WP_Post;
use WP_Query;

use function __return_empty_string;
use function absint;
use function add_action;
use function add_filter;
use function count;
use function current_user_can;
use function get_option;
use function get_post;
use function get_query_var;
use function get_the_title;
use function wp_verify_nonce;

defined( 'ABSPATH' ) || exit;

/**
 * Serves the surfer's whole page sequence off a single opaque index instead
 * of seeding real pages or exposing per-page identity: a request carrying
 * `?bsbSurfIndex=<n>&bsbNonce=<nonce>` resolves, entirely server-side, to the
 * saved surf-course order's `n`-th entry (wrapping via modulo, so the client
 * never needs to know how many pages exist), and the router injects that
 * entry's markup as a virtual post and lets WordPress render it through the
 * active theme — full header, footer, scripts and styles, with `the_content`
 * running `do_blocks()` on the markup. Nothing is seeded and no theme output
 * is stripped, so a course page reflects the theme exactly as any real page
 * would.
 *
 * This is a deliberate security boundary. The client (the cockpit's
 * `RunStore`) holds nothing but an incrementing counter — no page ids, URLs,
 * titles, order, or count ever reach it — so there is nothing in the request
 * for an attacker to read off or manipulate into targeting a specific page.
 * The route itself is gated, for EVERY entry it could resolve to (bundled or
 * user alike, decided only after the gate passes): `current_user_can()` for
 * the plugin's capability AND a valid `bsb_surf` nonce are both required
 * before any index is even resolved against the saved order. Neither
 * condition being met falls through untouched, ordinarily to a 404 — no
 * render path, bundled or user, is ever reached without both. The old
 * `?bsbSessionPage=<slug>` (and `user-<id>`) public routes are retired
 * entirely; a bundled slug is still resolved internally, against the
 * catalog, once an authorized request's index has picked it.
 *
 * Nothing in the URL besides the index and the nonce is allowed to decide
 * what gets served — in particular, never the `bsbTraits` behavior
 * parameter, which is the surf engine's behavior input, not a gate.
 *
 * The virtual post never touches the database: it exists only for the
 * duration of the request that asked for it.
 */
class CourseRouter implements Manager {

	/**
	 * Stores the catalog the pages come from and everything needed to gate
	 * and resolve an index request.
	 *
	 * @param CourseCatalog        $catalog         Source of the bundled course pages and their markup.
	 * @param string               $index_param     Query parameter carrying the opaque, client-incrementing page index.
	 * @param string               $nonce_param     Query parameter carrying the `bsb_surf` nonce authorizing the request.
	 * @param string               $nonce_action    Nonce action the surf nonce is verified against.
	 * @param string               $capability      Capability required to have an index request served.
	 * @param Assets               $assets          Service used to enqueue the course stylesheet and surf engine.
	 * @param string               $stylesheet      Course stylesheet, relative to the plugin root.
	 * @param string               $script          Surf engine script, relative to the plugin root.
	 * @param string               $body_class      Body-class marker stamped on every served course page.
	 * @param string               $option_name     Name of the option the surf-course order is saved under — the authoritative, server-side source of the sequence an index resolves against.
	 * @param CourseOrderSanitizer $order_sanitizer Heals the saved order on every read.
	 * @param UserPageView         $user_page_view  Renders a real user page's own title as a heading above its content, so a served user entry stays faithful to the real page.
	 */
	public function __construct(
		private CourseCatalog $catalog,
		private string $index_param,
		private string $nonce_param,
		private string $nonce_action,
		private string $capability,
		private Assets $assets,
		private string $stylesheet,
		private string $script,
		private string $body_class,
		private string $option_name,
		private CourseOrderSanitizer $order_sanitizer,
		private UserPageView $user_page_view
	) {
	}

	/**
	 * Registers the course query parameters and the main-query interceptor.
	 *
	 * @return void
	 */
	public function register(): void {
		add_filter( 'query_vars', array( $this, 'add_query_vars' ) );
		add_filter( 'the_posts', array( $this, 'maybe_render' ), 10, 2 );
	}

	/**
	 * Declares the course query parameters so WordPress parses them off the
	 * URL.
	 *
	 * @param array<int, string> $vars Registered public query vars.
	 * @return array<int, string> The query vars with the index and nonce parameters added.
	 */
	public function add_query_vars( array $vars ): array {
		$vars[] = $this->index_param;
		$vars[] = $this->nonce_param;

		return $vars;
	}

	/**
	 * Turns the main query into the course page named by the requested,
	 * authorized index, so the theme renders it as a singular page. Runs on
	 * the main query only and leaves every other query untouched.
	 *
	 * The gate — capability AND a valid `bsb_surf` nonce — is checked before
	 * anything about the saved order is even read, so it guards EVERY entry
	 * the index could resolve to, bundled or user alike; a request that
	 * fails either check never reaches the order at all and falls through to
	 * whatever the site would otherwise resolve (ordinarily a 404).
	 *
	 * @param array<int, WP_Post> $posts The posts the query found.
	 * @param WP_Query            $query The query being run.
	 * @return array<int, WP_Post> The resolved course page's virtual post, or the posts unchanged.
	 */
	public function maybe_render( array $posts, WP_Query $query ): array {
		if ( ! $query->is_main_query() ) {
			return $posts;
		}

		if ( '' === (string) get_query_var( $this->index_param, '' ) ) {
			return $posts;
		}

		if ( ! $this->request_authorized() ) {
			return $posts;
		}

		$page = $this->resolve_indexed_page();

		if ( null === $page ) {
			return $posts;
		}

		return $this->serve( $query, $page );
	}

	/**
	 * The authoritative, server-side gate every index request must clear
	 * before any entry — bundled or user — is resolved or rendered: the
	 * requester must hold the plugin capability AND carry a nonce valid for
	 * the `bsb_surf` action. Nothing else about the request has any say.
	 *
	 * @return bool Whether the request is authorized to have an index served.
	 */
	private function request_authorized(): bool {
		if ( ! current_user_can( $this->capability ) ) {
			return false;
		}

		$nonce = (string) get_query_var( $this->nonce_param, '' );

		return false !== wp_verify_nonce( $nonce, $this->nonce_action );
	}

	/**
	 * Resolves the requested index against the saved, healed surf-course
	 * order: the index wraps via modulo, so the client's ever-incrementing
	 * counter never needs to know how many pages exist. An empty order (which
	 * should not happen — bundled pages can never be dropped) resolves to
	 * nothing rather than dividing by zero.
	 *
	 * @return CoursePage|null The resolved course page, or null when the saved order is empty or the entry no longer resolves.
	 */
	private function resolve_indexed_page(): ?CoursePage {
		$order = $this->order_sanitizer->sanitize( get_option( $this->option_name, $this->order_sanitizer->default_order() ) );
		$count = count( $order );

		if ( 0 === $count ) {
			return null;
		}

		$index = absint( get_query_var( $this->index_param ) ) % $count;
		$entry = $order[ $index ];

		return 'bundled' === $entry['kind']
			? $this->catalog->find( $entry['slug'] )
			: $this->resolve_user_entry( $entry['id'] );
	}

	/**
	 * Resolves a user entry's post id to its real content. The sanitizer
	 * already validated the id when healing the saved order, so this only
	 * guards the rare case the post vanished between that read and this one.
	 *
	 * The returned page's content is the real post's own raw block markup
	 * with its title prefixed as a heading (see {@see UserPageView}) — a real
	 * page's title is a field separate from its content, so without the
	 * prefix a surfed user page would render without it. Prefixed or not,
	 * the content renders — and enqueues its blocks' own view assets —
	 * through the exact same `the_content` / `do_blocks()` path {@see serve()}
	 * already runs bundled pages through.
	 *
	 * @param int $id The user page's post id.
	 * @return CoursePage|null The resolved user page, or null when the post no longer resolves.
	 */
	private function resolve_user_entry( int $id ): ?CoursePage {
		$post = get_post( $id );

		if ( null === $post ) {
			return null;
		}

		$title   = get_the_title( $id );
		$content = $this->user_page_view->render(
			array(
				'title'   => $title,
				'content' => $post->post_content,
			)
		);

		return new CoursePage( 'user-' . $id, $title, $content );
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
