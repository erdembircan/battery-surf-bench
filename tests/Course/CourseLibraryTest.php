<?php
/**
 * Tests for the course library manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseLibrary;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\PageSeeder;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

use function has_action;

/**
 * The library is the course domain's public face: it seeds the catalog's pages
 * and lists them, with their live URLs, for the cockpit to surf. The tests run
 * it against the real bundled catalog and a recording seeder, so they assert
 * what the library asks the seeder to do and what it reports back, not how the
 * seeder persists pages.
 */
final class CourseLibraryTest extends TestCase {

	/**
	 * Builds a library over the real catalog and the given seeder.
	 *
	 * @param PageSeeder $seeder Seeder the library persists and resolves pages through.
	 * @return CourseLibrary The library under test.
	 */
	private function library( PageSeeder $seeder ): CourseLibrary {
		$catalog = new CourseCatalog( dirname( __DIR__, 2 ) . '/includes/Course/content', 'blank' );

		return new CourseLibrary( $catalog, $seeder );
	}

	/**
	 * A recording seeder that captures `ensure()` calls and returns a fixed URL.
	 *
	 * @param string|null $url URL `url()` should report (null to report "missing").
	 * @return PageSeeder The recording seeder.
	 */
	private function recording_seeder( ?string $url ): PageSeeder {
		return new class( '_m', $url ) extends PageSeeder {

			/**
			 * Captured `ensure()` calls.
			 *
			 * @var array<int, array<string, mixed>>
			 */
			public array $ensured = array();

			/**
			 * Stores the URL the stub reports.
			 *
			 * @param string      $marker_meta Unused marker meta key.
			 * @param string|null $url         URL to report from `url()`.
			 */
			public function __construct( string $marker_meta, private ?string $url ) {
				parent::__construct( $marker_meta );
			}

			/**
			 * Records the call instead of persisting a page.
			 *
			 * @param string      $marker   Page marker.
			 * @param string      $title    Page title.
			 * @param string      $content  Page block markup.
			 * @param string|null $template Requested template.
			 * @return int A stand-in post ID.
			 */
			public function ensure( string $marker, string $title, string $content, ?string $template = null ): int {
				$this->ensured[] = compact( 'marker', 'title', 'content', 'template' );

				return count( $this->ensured );
			}

			/**
			 * Reports the staged URL regardless of marker.
			 *
			 * @param string $marker Page marker.
			 * @return string|null The staged URL.
			 */
			public function url( string $marker ): ?string {
				return $this->url;
			}
		};
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->library( $this->recording_seeder( null ) ) );
	}

	/**
	 * Seeding is deferred to `init`, where the 'page' post type is available.
	 */
	public function test_register_hooks_seeding_onto_init(): void {
		$library = $this->library( $this->recording_seeder( null ) );
		$library->register();

		$this->assertNotFalse( has_action( 'init', array( $library, 'seed' ) ) );
	}

	/**
	 * Seeding asks the seeder to ensure each catalog page, under a course-
	 * namespaced marker and with the page's title, real markup and template.
	 */
	public function test_seed_ensures_each_catalog_page(): void {
		$seeder = $this->recording_seeder( null );
		$this->library( $seeder )->seed();

		$this->assertCount( 1, $seeder->ensured );
		$seeded = $seeder->ensured[0];
		$this->assertSame( 'course/article-1', $seeded['marker'] );
		$this->assertSame( 'The Hidden Cost of a Browser Tab', $seeded['title'] );
		$this->assertSame( 'blank', $seeded['template'] );
		$this->assertStringContainsString( '<!-- wp:', $seeded['content'] );
	}

	/**
	 * The links the cockpit surfs carry each page's slug, title and live URL.
	 */
	public function test_links_report_slug_title_and_url(): void {
		$links = $this->library( $this->recording_seeder( 'https://example.test/article-1' ) )->links();

		$this->assertSame(
			array(
				array(
					'slug'  => 'article-1',
					'title' => 'The Hidden Cost of a Browser Tab',
					'url'   => 'https://example.test/article-1',
				),
			),
			$links
		);
	}

	/**
	 * A page that has not been seeded yet (no resolvable URL) is left out of the
	 * list rather than reported with an empty URL the cockpit could not surf.
	 */
	public function test_links_skip_pages_without_a_url(): void {
		$this->assertSame( array(), $this->library( $this->recording_seeder( null ) )->links() );
	}
}
