<?php
/**
 * Tests for the course editor.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

/**
 * Behavioral tests for reading and writing the course, describing it for the
 * abilities, and judging which posts can join it.
 */
final class CourseEditorTest extends CourseTestCase {

	/**
	 * Builds a bundled course entry.
	 *
	 * @param string $slug The page's slug.
	 * @return array{kind: string, slug: string} The entry.
	 */
	private function bundled( string $slug ): array {
		return array(
			'kind' => 'bundled',
			'slug' => $slug,
		);
	}

	/**
	 * Builds a site page's course entry.
	 *
	 * @param int $id The post id.
	 * @return array{kind: string, id: int} The entry.
	 */
	private function user( int $id ): array {
		return array(
			'kind' => 'user',
			'id'   => $id,
		);
	}

	/** Before any course is saved the saved course is the default; a saved one is read back through the sanitizer, so an unpublished page is gone. */
	public function test_entries_default_to_the_bundled_pages_and_drop_pages_that_are_no_longer_published(): void {
		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ), array_column( $this->editor()->entries(), 'slug' ) );

		$this->add_post( 42, 'About', 'draft' );
		$this->set_course( array( $this->bundled( 'gallery' ), $this->user( 42 ) ) );

		$this->assertSame( array( 'gallery' ), array_column( $this->editor()->entries(), 'slug' ) );
	}

	/** Saving stores the course and hands back what was stored, which is what the sanitizer let through. */
	public function test_save_returns_what_was_stored(): void {
		$this->add_post( 42, 'About' );

		$saved = $this->editor()->save( array( $this->user( 42 ), $this->user( 999 ) ) );

		$this->assertSame( array( $this->user( 42 ) ), $saved );
		$this->assertSame( $saved, $this->options['bsbench_course_order'] );
	}

	/** A bundled page is described by its catalog title; a site page by its decoded title, type and link. */
	public function test_describe_bundled_and_site_pages(): void {
		$this->add_post( 42, 'Tom &amp; Jerry&#8217;s Guide', 'publish', 'post' );

		$pages = $this->editor()->describe( array( $this->bundled( 'gallery' ), $this->user( 42 ) ) );

		$this->assertSame( array( 1, 'bundled', 'gallery', null, 'Inside the Machine', null, null ), array_values( $pages[0] ) );
		$this->assertSame( array( 2, 'user', null, 42, 'Tom & Jerry’s Guide', 'post', 'https://example.test/?p=42' ), array_values( $pages[1] ) );
		$this->assertSame( array( 'position', 'kind', 'slug', 'post_id', 'title', 'post_type', 'url' ), array_keys( $pages[0] ) );
	}

	/** A private page is described by its plain title, without the "Private: " WordPress displays. */
	public function test_describe_uses_the_stored_title_without_a_private_prefix(): void {
		$this->add_post( 42, 'Team Notes', 'private' );

		$this->assertSame( 'Team Notes', $this->editor()->describe( array( $this->user( 42 ) ) )[0]['title'] );
	}

	/** Every bundled page is listed with whether the course includes it. */
	public function test_bundled_lists_every_page_with_whether_it_is_in_the_course(): void {
		$bundled = $this->editor()->bundled( array( $this->bundled( 'video' ) ) );

		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ), array_column( $bundled, 'slug' ) );
		$this->assertSame( array( false, false, false, true, false ), array_column( $bundled, 'in_course' ) );
		$this->assertSame( 'Inside the Machine', $bundled[1]['title'] );
	}

	/** The course is the default only when it is the bundled pages in their original order. */
	public function test_is_default_only_for_the_original_order(): void {
		$editor  = $this->editor();
		$default = $editor->entries();

		$this->assertTrue( $editor->is_default( $default ) );
		$this->assertFalse( $editor->is_default( array_reverse( $default ) ) );
		$this->assertFalse( $editor->is_default( array_slice( $default, 1 ) ) );
	}

	/** A page's position counts from 1, for a bundled page or a site page, and is null when the course doesn't have it. */
	public function test_position_of_counts_from_one(): void {
		$entries = array( $this->bundled( 'links' ), $this->user( 42 ) );
		$editor  = $this->editor();

		$this->assertSame( 1, $editor->position_of( $entries, null, 'links' ) );
		$this->assertSame( 2, $editor->position_of( $entries, 42, null ) );
		$this->assertNull( $editor->position_of( $entries, 43, null ) );
		$this->assertNull( $editor->position_of( $entries, null, 'gallery' ) );
		$this->assertNull( $editor->position_of( $entries, null, null ) );
	}

	/** A published, public post of a selectable type is eligible. */
	public function test_a_published_public_page_is_eligible(): void {
		$this->add_post( 42, 'About' );

		$this->assertTrue( $this->editor()->eligibility( 42 ) );
	}

	/** Each reason a post can't join, in the order the checks run: not found, type, private, status, visibility. */
	public function test_eligibility_reasons_in_order(): void {
		$this->add_post( 41, 'A product', 'draft', 'product' );
		$this->add_post( 42, 'A private product', 'private', 'product' );
		$this->add_post( 43, 'Team Notes', 'private' );
		$this->add_post( 44, 'Pricing', 'draft' );
		$this->add_post( 45, 'Hidden', 'publish', 'page', false );
		$editor = $this->editor();

		$this->assertError( $editor->eligibility( 404 ), 'bsbench_page_not_found', 404, "There's no post or page with the id 404." );
		$this->assertError( $editor->eligibility( 41 ), 'bsbench_page_wrong_type', 400, '“A product” can\'t be in the course: only posts and pages can.' );
		$this->assertError( $editor->eligibility( 42 ), 'bsbench_page_wrong_type', 400 );
		$this->assertError(
			$editor->eligibility( 43 ),
			'bsbench_page_private',
			400,
			'“Team Notes” can\'t be in the course because it\'s private. Only published, public posts and pages can be in the course.'
		);
		$this->assertError(
			$editor->eligibility( 44 ),
			'bsbench_page_not_published',
			400,
			'“Pricing” can\'t be in the course because it isn\'t published (its status is draft). Only published, public posts and pages can be in the course.'
		);
		$this->assertError(
			$editor->eligibility( 45 ),
			'bsbench_page_not_public',
			400,
			'“Hidden” can\'t be in the course because visitors can\'t view it. Only published, public posts and pages can be in the course.'
		);
	}
}
