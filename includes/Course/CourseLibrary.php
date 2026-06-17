<?php
/**
 * Course library.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use function add_query_arg;
use function home_url;

defined( 'ABSPATH' ) || exit;

/**
 * Lists the course's pages with the front-end URLs that serve them, in course
 * order. Each URL is the home URL with the course query parameter set to the
 * page's slug (e.g. `?bsbSessionPage=article-1`); hitting it makes the
 * {@see CourseRouter} render that page. This is the list the cockpit surfs —
 * the {@see \ErdemBircan\BatterySurfBench\Cockpit\CoursePagesSource} hands it to
 * the cockpit block through the Block Bindings API.
 *
 * The library owns the seam between the storage-agnostic {@see CourseCatalog}
 * and the request URLs the catalog's slugs resolve to, so consumers ask it for
 * surfable links and never build those URLs themselves.
 */
class CourseLibrary {

	/**
	 * Stores the catalog and the query parameter that selects a course page.
	 *
	 * @param CourseCatalog $catalog Source of the course's page definitions.
	 * @param string        $param   Query parameter the router reads the page slug from.
	 */
	public function __construct(
		private CourseCatalog $catalog,
		private string $param
	) {
	}

	/**
	 * Lists the course's pages with the URL that renders each one, in course
	 * order: each entry is the page's slug, title and surf URL.
	 *
	 * @return array<int, array{slug: string, title: string, url: string}> The course pages.
	 */
	public function links(): array {
		$links = array();

		foreach ( $this->catalog->pages() as $page ) {
			$links[] = array(
				'slug'  => $page->slug(),
				'title' => $page->title(),
				'url'   => add_query_arg( $this->param, $page->slug(), home_url( '/' ) ),
			);
		}

		return $links;
	}
}
