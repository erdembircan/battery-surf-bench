<?php
/**
 * Tests for the course editor.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use WP_Error;

/**
 * Behavioral tests for reading and writing the course, describing it for the
 * abilities, and judging which posts can join it.
 */
final class CourseEditorTest extends CourseTestCase {

	/**
	 * Before any course is saved, the saved course is the default: every bundled page.
	 */
	public function test_entries_default_to_the_bundled_pages_in_order(): void {
		$this->assertSame(
			array( 'article-1', 'gallery', 'article-2', 'video', 'links' ),
			array_column( $this->editor()->entries(), 'slug' )
		);
	}

	/**
	 * A saved course is read back through the sanitizer, so a page that has
	 * since been unpublished is gone from it.
	 */
	public function test_entries_drop_a_page_that_is_no_longer_published(): void {
		$this->add_post( 42, 'About', 'draft' );
		$this->set_course(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'gallery',
				),
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);

		$this->assertSame( array( 'gallery' ), array_column( $this->editor()->entries(), 'slug' ) );
	}

	/**
	 * Saving stores the course and hands back what was stored, which is what the
	 * sanitizer let through, not what was asked for.
	 */
	public function test_save_returns_what_was_stored(): void {
		$this->add_post( 42, 'About' );
		$entries = array(
			array(
				'kind' => 'user',
				'id'   => 42,
			),
			array(
				'kind' => 'user',
				'id'   => 999,
			),
		);

		$saved = $this->editor()->save( $entries );

		$this->assertSame(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			),
			$saved
		);
		$this->assertSame( $saved, $this->options['bsbench_course_order'] );
	}

	/**
	 * Resetting stores the default course.
	 */
	public function test_reset_stores_the_default_course(): void {
		$this->set_course(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'links',
				),
			)
		);

		$editor = $this->editor();

		$this->assertTrue( $editor->is_default( $editor->reset() ) );
	}

	/**
	 * A bundled page is described by its catalog title; it has no post.
	 */
	public function test_describe_a_bundled_page(): void {
		$pages = $this->editor()->describe(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'gallery',
				),
			)
		);

		$this->assertSame(
			array(
				array(
					'position'  => 1,
					'kind'      => 'bundled',
					'slug'      => 'gallery',
					'post_id'   => null,
					'title'     => 'Inside the Machine',
					'post_type' => null,
					'url'       => null,
				),
			),
			$pages
		);
	}

	/**
	 * A site page is described by its decoded title, type and link.
	 */
	public function test_describe_a_site_page(): void {
		$this->add_post( 42, 'Tom &amp; Jerry&#8217;s Guide', 'publish', 'post' );

		$pages = $this->editor()->describe(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'links',
				),
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);

		$this->assertSame(
			array(
				'position'  => 2,
				'kind'      => 'user',
				'slug'      => null,
				'post_id'   => 42,
				'title'     => 'Tom & Jerry’s Guide',
				'post_type' => 'post',
				'url'       => 'https://example.test/?p=42',
			),
			$pages[1]
		);
	}

	/**
	 * Every bundled page is listed with whether the course includes it.
	 */
	public function test_bundled_lists_every_page_with_whether_it_is_in_the_course(): void {
		$bundled = $this->editor()->bundled(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'video',
				),
			)
		);

		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ), array_column( $bundled, 'slug' ) );
		$this->assertSame( array( false, false, false, true, false ), array_column( $bundled, 'in_course' ) );
		$this->assertSame( 'Inside the Machine', $bundled[1]['title'] );
	}

	/**
	 * The course is the default only when it is the bundled pages in their original order.
	 */
	public function test_is_default_only_for_the_original_order(): void {
		$editor  = $this->editor();
		$default = $editor->entries();

		$this->assertTrue( $editor->is_default( $default ) );
		$this->assertFalse( $editor->is_default( array_reverse( $default ) ) );
		$this->assertFalse( $editor->is_default( array_slice( $default, 1 ) ) );
	}

	/**
	 * A page's position counts from 1, whether it is a bundled page or a site
	 * page, and is null when the course doesn't have it.
	 */
	public function test_position_of_counts_from_one(): void {
		$entries = array(
			array(
				'kind' => 'bundled',
				'slug' => 'links',
			),
			array(
				'kind' => 'user',
				'id'   => 42,
			),
		);
		$editor  = $this->editor();

		$this->assertSame( 1, $editor->position_of( $entries, null, 'links' ) );
		$this->assertSame( 2, $editor->position_of( $entries, 42, null ) );
		$this->assertNull( $editor->position_of( $entries, 43, null ) );
		$this->assertNull( $editor->position_of( $entries, null, 'gallery' ) );
		$this->assertNull( $editor->position_of( $entries, null, null ) );
	}

	/**
	 * A published, public post of a selectable type is eligible.
	 */
	public function test_a_published_public_page_is_eligible(): void {
		$this->add_post( 42, 'About' );

		$this->assertTrue( $this->editor()->eligibility( 42 ) );
	}

	/**
	 * A post that doesn't exist is a 404.
	 */
	public function test_a_missing_post_is_not_found(): void {
		$result = $this->editor()->eligibility( 404 );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'bsbench_page_not_found', $result->get_error_code() );
		$this->assertSame( array( 'status' => 404 ), $result->get_error_data() );
		$this->assertSame( "There's no post or page with the id 404.", $result->get_error_message() );
	}

	/**
	 * A post of a type that isn't a post or page is refused as the wrong type.
	 */
	public function test_a_post_of_another_type_is_the_wrong_type(): void {
		$this->add_post( 42, 'A product', 'publish', 'product' );

		$result = $this->editor()->eligibility( 42 );

		$this->assertSame( 'bsbench_page_wrong_type', $result->get_error_code() );
		$this->assertSame( array( 'status' => 400 ), $result->get_error_data() );
		$this->assertSame( '“A product” can\'t be in the course: only posts and pages can.', $result->get_error_message() );
	}

	/**
	 * A post that isn't published is refused, and the reason names its status.
	 */
	public function test_an_unpublished_post_is_refused_with_its_status(): void {
		$this->add_post( 42, 'Pricing', 'draft' );

		$result = $this->editor()->eligibility( 42 );

		$this->assertSame( 'bsbench_page_not_published', $result->get_error_code() );
		$this->assertSame( array( 'status' => 400 ), $result->get_error_data() );
		$this->assertSame(
			'“Pricing” can\'t be in the course because it isn\'t published (its status is draft). Only published, public posts and pages can be in the course.',
			$result->get_error_message()
		);
	}

	/**
	 * A published post visitors can't view is refused.
	 */
	public function test_a_published_post_visitors_cannot_view_is_refused(): void {
		$this->add_post( 42, 'Hidden', 'publish', 'page', false );

		$result = $this->editor()->eligibility( 42 );

		$this->assertSame( 'bsbench_page_not_public', $result->get_error_code() );
		$this->assertSame( array( 'status' => 400 ), $result->get_error_data() );
		$this->assertSame(
			'“Hidden” can\'t be in the course because visitors can\'t view it. Only published, public posts and pages can be in the course.',
			$result->get_error_message()
		);
	}

	/**
	 * The checks run in order: a draft of the wrong type is reported as the
	 * wrong type, before its status.
	 */
	public function test_the_type_is_checked_before_the_status(): void {
		$this->add_post( 42, 'A draft product', 'draft', 'product' );

		$this->assertSame( 'bsbench_page_wrong_type', $this->editor()->eligibility( 42 )->get_error_code() );
	}

	/**
	 * Input that names a site page reads as a user entry.
	 */
	public function test_entry_from_input_reads_a_site_page(): void {
		$this->assertSame(
			array(
				'kind' => 'user',
				'id'   => 42,
			),
			$this->editor()->entry_from_input( array( 'post_id' => 42 ) )
		);
	}

	/**
	 * Input that names a bundled page reads as a bundled entry.
	 */
	public function test_entry_from_input_reads_a_bundled_page(): void {
		$this->assertSame(
			array(
				'kind' => 'bundled',
				'slug' => 'video',
			),
			$this->editor()->entry_from_input( array( 'bundled_slug' => 'video' ) )
		);
	}

	/**
	 * Naming no page, or both, is a 400.
	 */
	public function test_entry_from_input_needs_exactly_one_page(): void {
		$editor = $this->editor();

		foreach ( array(
			array(),
			array(
				'post_id'      => 42,
				'bundled_slug' => 'video',
			),
		) as $input ) {
			$result = $editor->entry_from_input( $input );

			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 'bsbench_page_choice', $result->get_error_code() );
			$this->assertSame( array( 'status' => 400 ), $result->get_error_data() );
			$this->assertSame( 'Name exactly one page: a post_id or a bundled_slug.', $result->get_error_message() );
		}
	}

	/**
	 * The course output carries the pages, their count, whether it is the
	 * default, and the bundled pages.
	 */
	public function test_course_output_shape(): void {
		$editor = $this->editor();
		$course = $editor->course( $editor->entries() );

		$this->assertSame( array( 'pages', 'page_count', 'is_default', 'bundled_pages' ), array_keys( $course ) );
		$this->assertSame( 5, $course['page_count'] );
		$this->assertTrue( $course['is_default'] );
		$this->assertCount( 5, $course['pages'] );
		$this->assertCount( 5, $course['bundled_pages'] );
	}

	/**
	 * The input properties that name a page offer the bundled slugs as the choices.
	 */
	public function test_page_properties_enumerate_the_bundled_slugs(): void {
		$properties = $this->editor()->page_properties();

		$this->assertSame( array( 'post_id', 'bundled_slug' ), array_keys( $properties ) );
		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ), $properties['bundled_slug']['enum'] );
		$this->assertSame( 1, $properties['post_id']['minimum'] );
	}

	/**
	 * A page already in the course is a 409 naming its title and position.
	 */
	public function test_already_in_course_names_the_page_and_its_position(): void {
		$result = $this->editor()->already_in_course(
			array(
				'kind' => 'bundled',
				'slug' => 'gallery',
			),
			2
		);

		$this->assertSame( 'bsbench_page_in_course', $result->get_error_code() );
		$this->assertSame( array( 'status' => 409 ), $result->get_error_data() );
		$this->assertSame( '“Inside the Machine” is already in the course, at position 2.', $result->get_error_message() );
	}

	/**
	 * A page that isn't in the course is a 404 naming its title, or its id when
	 * the post doesn't exist.
	 */
	public function test_not_in_course_names_the_page_or_its_id(): void {
		$this->add_post( 42, 'About' );
		$editor = $this->editor();

		$known = $editor->not_in_course(
			array(
				'kind' => 'user',
				'id'   => 42,
			)
		);
		$gone  = $editor->not_in_course(
			array(
				'kind' => 'user',
				'id'   => 777,
			)
		);

		$this->assertSame( 'bsbench_page_not_in_course', $known->get_error_code() );
		$this->assertSame( array( 'status' => 404 ), $known->get_error_data() );
		$this->assertSame( '“About” isn\'t in the course.', $known->get_error_message() );
		$this->assertSame( '“777” isn\'t in the course.', $gone->get_error_message() );
	}

	/**
	 * A position outside the course is a 400 naming the highest one allowed.
	 */
	public function test_out_of_range_names_the_highest_position(): void {
		$result = $this->editor()->out_of_range( 9, 6 );

		$this->assertSame( 'bsbench_position_out_of_range', $result->get_error_code() );
		$this->assertSame( array( 'status' => 400 ), $result->get_error_data() );
		$this->assertSame( 'Position 9 is out of range: choose a position from 1 to 6.', $result->get_error_message() );
	}
}
