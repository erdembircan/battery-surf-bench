<?php
/**
 * Tests for the course library.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseLibrary;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The library lists the course's pages with the front-end URL that serves each
 * one — the list the cockpit surfs. The tests run it against the real catalog
 * and assert the slug/title/URL it reports, with the WordPress URL helpers
 * stubbed to a predictable form.
 */
final class CourseLibraryTest extends TestCase {

	private const PARAM = 'bsbSessionPage';

	/**
	 * Stubs the URL helpers the library composes surf URLs from.
	 */
	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'home_url' )->justReturn( 'https://example.test/' );
		Functions\when( 'add_query_arg' )->alias(
			static fn ( string $key, string $value, string $url ): string => $url . '?' . $key . '=' . $value
		);
	}

	/**
	 * Builds a library over the real catalog.
	 *
	 * @return CourseLibrary The library under test.
	 */
	private function library(): CourseLibrary {
		$catalog = new CourseCatalog( dirname( __DIR__, 2 ) . '/includes/Course/content' );

		return new CourseLibrary( $catalog, self::PARAM );
	}

	/**
	 * Each link carries the page's slug, title, and the home URL with the course
	 * parameter set to the slug — the URL that makes the router render the page.
	 */
	public function test_links_report_slug_title_and_surf_url(): void {
		$links = $this->library()->links();

		$this->assertSame(
			array(
				array(
					'slug'  => 'article-1',
					'title' => 'The Hidden Cost of a Browser Tab',
					'url'   => 'https://example.test/?bsbSessionPage=article-1',
				),
			),
			$links
		);
	}
}
