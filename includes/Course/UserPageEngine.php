<?php
/**
 * Surf engine on real user pages.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Support\Manager;

use function add_action;
use function add_filter;
use function get_option;
use function get_queried_object_id;
use function get_query_var;
use function in_array;
use function is_singular;

defined( 'ABSPATH' ) || exit;

/**
 * Runs the surf engine on a real, user-selected page — the counterpart to
 * {@see CourseRouter}, which runs it on the plugin's bundled virtual pages.
 * A user page is a real post served entirely by the active theme, so this
 * manager's only job is to enqueue the surf engine script and stamp the
 * shared course-page body-class marker, and only for a genuine surfer visit;
 * it never touches the course stylesheet, which styles bundled markup the
 * user's own page does not carry.
 *
 * Three conditions must all hold before anything is enqueued or stamped: the
 * request is a real singular view, the viewed post is one of the ids saved
 * in the surf-course order's `user` entries, and the traits query parameter
 * — carried only by a surfer iframe visit ({@see
 * \ErdemBircan\BatterySurfBench\Config}'s `course.traits_param`, appended by
 * `src/cockpit/SurferUrl.ts`'s `TRAITS_PARAM`), never by a human opening the
 * page directly — is present. Missing any one of them leaves the page
 * exactly as the theme would otherwise render it.
 */
class UserPageEngine implements Manager {

	/**
	 * Stores the collaborators needed to gate, enqueue and mark a surfed user
	 * page.
	 *
	 * @param string               $option_name  Name of the option the surf-course order is saved under.
	 * @param CourseOrderSanitizer $sanitizer    Heals the saved order so the user id set here matches what {@see CourseLibrary} would emit.
	 * @param Assets               $assets       Service used to enqueue the surf engine script.
	 * @param string               $script       Surf engine script, relative to the plugin root — the same handle {@see CourseRouter} enqueues.
	 * @param string               $traits_param Query parameter a surfer iframe visit always carries.
	 * @param string               $body_class   Body-class marker the viewport load guard looks for, shared with {@see CourseRouter}.
	 */
	public function __construct(
		private string $option_name,
		private CourseOrderSanitizer $sanitizer,
		private Assets $assets,
		private string $script,
		private string $traits_param,
		private string $body_class
	) {
	}

	/**
	 * Hooks the traits query var registration, the surf engine enqueue and the
	 * body-class marker into the WordPress lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_filter( 'query_vars', array( $this, 'add_query_var' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
		add_filter( 'body_class', array( $this, 'mark_body' ) );
	}

	/**
	 * Declares the traits query parameter as a public query var, so
	 * `get_query_var()` can read its presence without touching the request
	 * superglobal directly.
	 *
	 * @param array<int, string> $vars Registered public query vars.
	 * @return array<int, string> The query vars with the traits parameter added.
	 */
	public function add_query_var( array $vars ): array {
		$vars[] = $this->traits_param;

		return $vars;
	}

	/**
	 * Enqueues the surf engine script, but only for a genuine surfer visit to
	 * a saved user page.
	 *
	 * @return void
	 */
	public function enqueue(): void {
		if ( ! $this->is_surfed_user_page() ) {
			return;
		}

		$this->assets->enqueue( $this->script );
	}

	/**
	 * Appends the shared course-page marker to the body classes, but only for
	 * a genuine surfer visit to a saved user page.
	 *
	 * @param array<int, string> $classes The body classes WordPress assembled.
	 * @return array<int, string> The classes, with the marker appended when gated in.
	 */
	public function mark_body( array $classes ): array {
		if ( ! $this->is_surfed_user_page() ) {
			return $classes;
		}

		$classes[] = $this->body_class;

		return $classes;
	}

	/**
	 * Whether the current request is a genuine surfer visit to one of the
	 * saved user pages: a real singular view of a post id in the saved
	 * order's user set, requested with the traits parameter a surfer iframe
	 * visit always carries. A human opening their own page directly carries no
	 * traits parameter and fails this check.
	 *
	 * @return bool Whether the current request should run the surf engine.
	 */
	private function is_surfed_user_page(): bool {
		if ( ! is_singular() || '' === get_query_var( $this->traits_param, '' ) ) {
			return false;
		}

		return in_array( get_queried_object_id(), $this->user_page_ids(), true );
	}

	/**
	 * Reads and heals the saved surf-course order, then extracts the set of
	 * user post ids it names — the same set {@see CourseLibrary} would list
	 * as `user` links.
	 *
	 * @return array<int, int> The saved order's user post ids.
	 */
	private function user_page_ids(): array {
		$order = $this->sanitizer->sanitize( get_option( $this->option_name, $this->sanitizer->default_order() ) );
		$ids   = array();

		foreach ( $order as $entry ) {
			if ( 'user' === $entry['kind'] ) {
				$ids[] = $entry['id'];
			}
		}

		return $ids;
	}
}
