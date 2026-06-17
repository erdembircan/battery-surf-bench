<?php
/**
 * Tests for the course catalog.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The catalog is the single source of truth for the course: which pages exist
 * and the block markup each one ships. The tests run it against the plugin's
 * real bundled content directory, the same files it loads in production.
 */
final class CourseCatalogTest extends TestCase {

	/**
	 * Absolute path to the plugin's bundled course content directory.
	 *
	 * @return string The content directory path.
	 */
	private function content_dir(): string {
		return dirname( __DIR__, 2 ) . '/includes/Course/content';
	}

	/**
	 * The catalog yields the course's page with its title and the block markup
	 * loaded from the bundled file.
	 */
	public function test_pages_load_their_bundled_markup(): void {
		$pages = ( new CourseCatalog( $this->content_dir() ) )->pages();

		$this->assertCount( 1, $pages );
		$this->assertSame( 'article-1', $pages[0]->slug() );
		$this->assertSame( 'The Hidden Cost of a Browser Tab', $pages[0]->title() );
		$this->assertStringContainsString( '<!-- wp:', $pages[0]->content() );
	}

	/**
	 * A known slug resolves to its page, markup loaded.
	 */
	public function test_find_returns_a_known_page(): void {
		$page = ( new CourseCatalog( $this->content_dir() ) )->find( 'article-1' );

		$this->assertNotNull( $page );
		$this->assertSame( 'article-1', $page->slug() );
		$this->assertStringContainsString( '<!-- wp:', $page->content() );
	}

	/**
	 * A slug outside the course resolves to null, so the router leaves the
	 * request alone instead of serving a blank page.
	 */
	public function test_find_returns_null_for_an_unknown_slug(): void {
		$this->assertNull( ( new CourseCatalog( $this->content_dir() ) )->find( 'not-a-page' ) );
	}

	/**
	 * A missing content directory yields empty content rather than a fatal
	 * error, so a packaging slip degrades to a blank page instead of a crash.
	 */
	public function test_missing_content_file_yields_empty_content(): void {
		$pages = ( new CourseCatalog( '/no/such/dir' ) )->pages();

		$this->assertSame( '', $pages[0]->content() );
	}
}
