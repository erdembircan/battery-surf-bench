<?php
/**
 * Tests for the course page value object.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use ErdemBircan\BatterySurfBench\Course\CoursePage;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The course page is a plain definition; its consumers (the catalog, the
 * library) read back exactly what they were given.
 */
final class CoursePageTest extends TestCase {

	/**
	 * Each field is exposed verbatim through its accessor.
	 */
	public function test_exposes_its_definition(): void {
		$page = new CoursePage( 'article-1', 'The Hidden Cost of a Browser Tab', '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->', 'blank' );

		$this->assertSame( 'article-1', $page->slug() );
		$this->assertSame( 'The Hidden Cost of a Browser Tab', $page->title() );
		$this->assertSame( '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->', $page->content() );
		$this->assertSame( 'blank', $page->template() );
	}

	/**
	 * An empty template means "the theme's default" and is preserved as such.
	 */
	public function test_preserves_an_empty_template(): void {
		$page = new CoursePage( 'article-1', 'Title', 'content', '' );

		$this->assertSame( '', $page->template() );
	}
}
