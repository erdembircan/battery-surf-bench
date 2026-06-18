<?php
/**
 * Tests for the course catalog.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use WP_Filesystem_Base;

/**
 * The catalog is the single source of truth for the course: which pages exist
 * and the block markup each one ships. It reads markup through the WordPress
 * filesystem abstraction, which is mocked here with an in-memory double — no
 * real files or directories are touched.
 */
final class CourseCatalogTest extends TestCase {

	private const CONTENT_DIR = '/plugin/includes/Course/content';
	private const MARKUP      = '<!-- wp:paragraph --><p>Course markup.</p><!-- /wp:paragraph -->';

	/**
	 * Installs a filesystem double that has every file and serves known markup,
	 * so the catalog reads through the abstraction without disk access.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['wp_filesystem'] = $this->filesystem( true, self::MARKUP );
	}

	/**
	 * Restores a clean filesystem double so a test that swaps or clears it does
	 * not leak into the next.
	 */
	protected function tearDown(): void {
		$GLOBALS['wp_filesystem'] = new WP_Filesystem_Base();
		parent::tearDown();
	}

	/**
	 * Builds an in-memory filesystem double reporting the given existence and
	 * contents for any path.
	 *
	 * @param bool         $exists   Whether the double reports files as present.
	 * @param string|false $contents Contents `get_contents()` returns.
	 * @return WP_Filesystem_Base The configured double.
	 */
	private function filesystem( bool $exists, string|false $contents ): WP_Filesystem_Base {
		return new class( $exists, $contents ) extends WP_Filesystem_Base {

			/**
			 * Stores the staged existence and contents.
			 *
			 * @param bool         $present Existence the double reports.
			 * @param string|false $body    Contents the double serves.
			 */
			public function __construct( private bool $present, private string|false $body ) {
			}

			/**
			 * Reports the staged existence for any path.
			 *
			 * @param string $path Path to test.
			 * @return bool The staged existence.
			 */
			public function exists( $path ): bool {
				return $this->present;
			}

			/**
			 * Returns the staged contents for any path.
			 *
			 * @param string $file Path to read.
			 * @return string|false The staged contents.
			 */
			public function get_contents( $file ) {
				return $this->body;
			}
		};
	}

	/**
	 * The catalog yields the course's pages, each carrying its slug and title
	 * from the definitions and the markup the filesystem reports. The course
	 * opens with article-1.
	 */
	public function test_pages_carry_their_definitions_and_loaded_markup(): void {
		$pages = ( new CourseCatalog( self::CONTENT_DIR ) )->pages();

		$this->assertSame( 'article-1', $pages[0]->slug() );
		$this->assertSame( 'The Hidden Cost of a Browser Tab', $pages[0]->title() );

		foreach ( $pages as $page ) {
			$this->assertNotSame( '', $page->slug() );
			$this->assertNotSame( '', $page->title() );
			$this->assertSame( self::MARKUP, $page->content() );
		}
	}

	/**
	 * A known slug resolves to its page, with the markup the filesystem reports.
	 */
	public function test_find_returns_a_known_page_with_loaded_markup(): void {
		$page = ( new CourseCatalog( self::CONTENT_DIR ) )->find( 'article-1' );

		$this->assertNotNull( $page );
		$this->assertSame( 'article-1', $page->slug() );
		$this->assertSame( self::MARKUP, $page->content() );
	}

	/**
	 * A slug outside the course resolves to null, so the router leaves the
	 * request alone instead of serving a blank page.
	 */
	public function test_find_returns_null_for_an_unknown_slug(): void {
		$this->assertNull( ( new CourseCatalog( self::CONTENT_DIR ) )->find( 'not-a-page' ) );
	}

	/**
	 * When the filesystem reports a page's file absent, the catalog yields empty
	 * content rather than a fatal error, so a packaging slip degrades to a blank
	 * page instead of a crash.
	 */
	public function test_absent_content_file_yields_empty_content(): void {
		$GLOBALS['wp_filesystem'] = $this->filesystem( false, false );

		$pages = ( new CourseCatalog( self::CONTENT_DIR ) )->pages();

		$this->assertSame( '', $pages[0]->content() );
	}

	/**
	 * When the host cannot grant filesystem credentials for the content
	 * directory, the catalog degrades to empty content instead of reading the
	 * file or fataling — the page renders blank rather than crashing the request.
	 */
	public function test_denied_filesystem_credentials_yield_empty_content(): void {
		unset( $GLOBALS['wp_filesystem'] );
		Functions\when( 'WP_Filesystem' )->justReturn( false );
		Functions\expect( 'request_filesystem_credentials' )->once()->andReturn( false );

		$page = ( new CourseCatalog( self::CONTENT_DIR ) )->find( 'article-1' );

		$this->assertNotNull( $page );
		$this->assertSame( '', $page->content() );
	}
}
