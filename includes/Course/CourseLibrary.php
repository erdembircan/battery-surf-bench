<?php
/**
 * Course library.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use function add_query_arg;
use function get_option;
use function get_permalink;
use function get_the_title;
use function home_url;

defined( 'ABSPATH' ) || exit;

/**
 * Lists the surfer's full page sequence with the front-end URL that serves
 * each one, in saved course order. Each entry is either one of the plugin's
 * bundled pages ({@see CourseCatalog}), served by the {@see CourseRouter} off
 * the course query parameter (e.g. `?bsbSessionPage=article-1`), or a real
 * post or page a site owner chose from the settings screen, served entirely
 * by the theme and run by {@see UserPageEngine}. This is the list the
 * cockpit surfs — the
 * {@see \ErdemBircan\BatterySurfBench\Cockpit\CoursePagesSource} hands it to
 * the cockpit block through the Block Bindings API.
 *
 * The library owns the seam between the storage-agnostic saved order and the
 * request URLs its entries resolve to, so consumers ask it for surfable links
 * and never build those URLs or read the option themselves.
 */
class CourseLibrary {

	/**
	 * Stores the catalog, the course query parameter, and the collaborators
	 * needed to read and heal the saved surf-course order.
	 *
	 * @param CourseCatalog        $catalog     Source of the bundled page definitions.
	 * @param string               $param       Query parameter the router reads a bundled page's slug from.
	 * @param string               $option_name Name of the option the surf-course order is saved under.
	 * @param CourseOrderSanitizer $sanitizer   Heals the saved order on every read — `register_setting`'s sanitize callback only runs on write.
	 */
	public function __construct(
		private CourseCatalog $catalog,
		private string $param,
		private string $option_name,
		private CourseOrderSanitizer $sanitizer
	) {
	}

	/**
	 * Lists the surfer's full page sequence with the URL that renders each
	 * entry, in saved course order: a slug, a title, and a surf URL. A missing
	 * or empty saved order falls back to the sanitizer's default — the five
	 * bundled pages in catalog order — which is exactly today's behavior
	 * before any user page has ever been added.
	 *
	 * @return array<int, array{slug: string, title: string, url: string}> The surfer's page sequence.
	 */
	public function links(): array {
		$order = $this->sanitizer->sanitize( get_option( $this->option_name, $this->sanitizer->default_order() ) );

		$links = array();

		foreach ( $order as $entry ) {
			$links[] = 'bundled' === $entry['kind']
				? $this->bundled_link( $entry['slug'] )
				: $this->user_link( $entry['id'] );
		}

		return $links;
	}

	/**
	 * Builds the link for a bundled catalog page: the router URL that serves
	 * it off the course query parameter. The sanitizer only ever admits a
	 * slug the catalog actually carries, so the lookup here always resolves.
	 *
	 * @param string $slug The bundled page's slug.
	 * @return array{slug: string, title: string, url: string} The bundled page's link.
	 */
	private function bundled_link( string $slug ): array {
		$page = $this->catalog->find( $slug );

		return array(
			'slug'  => $slug,
			'title' => $page->title(),
			'url'   => add_query_arg( $this->param, $slug, home_url( '/' ) ),
		);
	}

	/**
	 * Builds the link for a user-selected page: its own real permalink, run
	 * by {@see UserPageEngine} rather than the course router. The sanitizer
	 * only ever admits a post id that still exists, is published and is
	 * publicly viewable, so the title/permalink lookups here always resolve.
	 *
	 * @param int $id The user page's post id.
	 * @return array{slug: string, title: string, url: string} The user page's link.
	 */
	private function user_link( int $id ): array {
		return array(
			'slug'  => 'user-' . $id,
			'title' => get_the_title( $id ),
			'url'   => get_permalink( $id ),
		);
	}
}
