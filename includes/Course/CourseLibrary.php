<?php
/**
 * Course library manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\PageSeeder;

use function add_action;

defined( 'ABSPATH' ) || exit;

/**
 * Turns the {@see CourseCatalog}'s definitions into real, theme-rendered
 * WordPress pages and is the course domain's public face to the rest of the
 * plugin. It seeds each catalog page on boot (idempotently, through the
 * {@see PageSeeder}) and answers {@see CourseLibrary::links()} with the live
 * slug/title/URL of every page — the list the cockpit's Block Bindings source
 * hands to the cockpit block.
 *
 * It owns the seam between "what the course is" (the catalog) and "where it
 * lives" (the seeded pages), so consumers ask the library for URLs and never
 * reach into the catalog or the database themselves.
 */
class CourseLibrary implements Manager {

	/**
	 * Stores the catalog that defines the course and the seeder that persists it.
	 *
	 * @param CourseCatalog $catalog Source of the course's page definitions.
	 * @param PageSeeder    $seeder  Creates and maintains the pages the course renders on.
	 */
	public function __construct(
		private CourseCatalog $catalog,
		private PageSeeder $seeder
	) {
	}

	/**
	 * Hooks page seeding onto `init`, where the pages' post type ('page') and
	 * the rest of WordPress are available.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'seed' ) );
	}

	/**
	 * Ensures every page the catalog defines exists as a published page with
	 * its current content and requested template.
	 *
	 * @return void
	 */
	public function seed(): void {
		foreach ( $this->catalog->pages() as $page ) {
			$this->seeder->ensure(
				$this->marker( $page->slug() ),
				$page->title(),
				$page->content(),
				$page->template()
			);
		}
	}

	/**
	 * Lists the course's pages with their live public URLs, in course order.
	 * This is the data the cockpit surfs: each entry is the page's slug, title
	 * and the permalink of the page the catalog page was seeded onto.
	 *
	 * @return array<int, array{slug: string, title: string, url: string}> The course pages.
	 */
	public function links(): array {
		$links = array();

		foreach ( $this->catalog->pages() as $page ) {
			$url = $this->seeder->url( $this->marker( $page->slug() ) );

			if ( null === $url ) {
				continue;
			}

			$links[] = array(
				'slug'  => $page->slug(),
				'title' => $page->title(),
				'url'   => $url,
			);
		}

		return $links;
	}

	/**
	 * Builds the seed marker a course page is stored under, namespacing the
	 * page slug so course pages never collide with other seeded pages.
	 *
	 * @param string $slug The course page's slug.
	 * @return string The page's seed marker.
	 */
	private function marker( string $slug ): string {
		return 'course/' . $slug;
	}
}
