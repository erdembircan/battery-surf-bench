<?php
/**
 * Tests for the abilities that read and edit the surf course.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\AddCoursePage;
use ErdemBircan\BatterySurfBench\Abilities\FindPages;
use ErdemBircan\BatterySurfBench\Abilities\GetCourse;
use ErdemBircan\BatterySurfBench\Abilities\MoveCoursePage;
use ErdemBircan\BatterySurfBench\Abilities\RemoveCoursePage;
use ErdemBircan\BatterySurfBench\Abilities\ResetCourse;
use WP_Post;

/**
 * Behavioral tests for the course abilities, through the real editor over a
 * stubbed site: what each one returns, where pages land, and why each is refused.
 */
final class CourseAbilitiesTest extends CourseTestCase {

	/**
	 * Lists the saved course as short labels (`article-1`, `#42`).
	 *
	 * @return array<int, string> The saved course.
	 */
	private function saved(): array {
		return array_map(
			static fn ( array $entry ): string => 'bundled' === $entry['kind'] ? $entry['slug'] : '#' . $entry['id'],
			$this->options['bsbench_course_order']
		);
	}

	/**
	 * Saves a course of the given labels (`gallery`, `#42`).
	 *
	 * @param string ...$labels The course, in visit order.
	 */
	private function course( string ...$labels ): void {
		$this->set_course(
			array_map(
				static fn ( string $label ): array => str_starts_with( $label, '#' )
					? array(
						'kind' => 'user',
						'id'   => (int) substr( $label, 1 ),
					)
					: array(
						'kind' => 'bundled',
						'slug' => $label,
					),
				$labels
			)
		);
	}

	/** A site that never saved a course has the default one; a saved course lists its pages in visit order. */
	public function test_get_course_returns_the_default_and_the_saved_course(): void {
		$get     = new GetCourse( $this->editor() );
		$default = $get->execute( array() );

		$this->assertSame( 5, $default['page_count'] );
		$this->assertTrue( $default['is_default'] );
		$this->assertSame( 'The Hidden Cost of a Browser Tab', $default['pages'][0]['title'] );

		$this->add_post( 42, 'Contact' );
		$this->course( '#42', 'video' );

		$saved = $get->execute( array() );

		$this->assertSame( 2, $saved['page_count'] );
		$this->assertFalse( $saved['is_default'] );
		$this->assertSame( array( 'user', 'bundled' ), array_column( $saved['pages'], 'kind' ) );
		$this->assertSame( 'Contact', $saved['pages'][0]['title'] );
		$this->assertSame( array( false, false, false, true, false ), array_column( $saved['bundled_pages'], 'in_course' ) );
		$this->assertSame( array( 'pages', 'page_count', 'is_default', 'bundled_pages' ), array_keys( $saved ) );
	}

	/** A customized course is replaced with the bundled pages in their original order, and doing it again changes nothing. */
	public function test_reset_saves_the_default_course(): void {
		$this->add_post( 42, 'Contact' );
		$this->course( '#42', 'links' );

		$reset = new ResetCourse( $this->editor(), $this->sanitizer );
		$first = $reset->execute( array() );

		$this->assertTrue( $first['is_default'] );
		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links' ), $this->saved() );
		$this->assertSame( $first, $reset->execute( array() ) );
	}

	/** Adding appends by default or inserts at a position, for a site page or a bundled one. */
	public function test_add_puts_a_page_at_the_end_or_at_a_position(): void {
		$this->add_post( 42, 'About' );
		$add = new AddCoursePage( $this->editor() );

		$appended = $add->execute( array( 'post_id' => 42 ) );

		$this->assertSame( array( 'article-1', 'gallery', 'article-2', 'video', 'links', '#42' ), $this->saved() );
		$this->assertSame( 6, $appended['page_count'] );
		$this->assertFalse( $appended['is_default'] );
		$this->assertSame( 6, $appended['added']['position'] );
		$this->assertSame( 'About', $appended['added']['title'] );

		$this->course( 'article-1' );
		$inserted = $add->execute(
			array(
				'bundled_slug' => 'video',
				'position'     => 1,
			)
		);

		$this->assertSame( array( 'video', 'article-1' ), $this->saved() );
		$this->assertSame( 'Watch: Nineteen Seconds That Started It All', $inserted['added']['title'] );
		$this->assertSame( 1, $inserted['added']['position'] );
	}

	/** Each reason a page can't be added, with the status of the error. */
	public function test_add_refuses_pages_that_cannot_join(): void {
		$this->add_post( 43, 'Pricing', 'draft' );
		$this->add_post( 44, 'Team Notes', 'private', 'page', false );
		$add = new AddCoursePage( $this->editor() );

		$this->assertError( $add->execute( array( 'post_id' => 43 ) ), 'bsbench_page_not_published', 400 );
		$this->assertError(
			$add->execute( array( 'post_id' => 44 ) ),
			'bsbench_page_private',
			400,
			'“Team Notes” can\'t be in the course because it\'s private. Only published, public posts and pages can be in the course.'
		);
		$this->assertError( $add->execute( array( 'post_id' => 404 ) ), 'bsbench_page_not_found', 404 );
		$this->assertError( $add->execute( array( 'bundled_slug' => 'gallery' ) ), 'bsbench_page_in_course', 409, '“Inside the Machine” is already in the course, at position 2.' );
		$this->assertError( $add->execute( array() ), 'bsbench_page_choice', 400, 'Name exactly one page: a post_id or a bundled_slug.' );
		$this->assertError(
			$add->execute(
				array(
					'post_id'      => 43,
					'bundled_slug' => 'video',
				)
			),
			'bsbench_page_choice',
			400
		);
		$this->assertArrayNotHasKey( 'bsbench_course_order', $this->options );
	}

	/** The position just past the last page is the end; one further is out of range. */
	public function test_add_checks_the_position_against_the_course(): void {
		$this->add_post( 42, 'About' );
		$add = new AddCoursePage( $this->editor() );

		$this->assertError(
			$add->execute(
				array(
					'post_id'  => 42,
					'position' => 8,
				)
			),
			'bsbench_position_out_of_range',
			400,
			'Position 8 is out of range: choose a position from 1 to 6.'
		);
		$this->assertSame(
			6,
			$add->execute(
				array(
					'post_id'  => 42,
					'position' => 6,
				)
			)['added']['position']
		);
	}

	/** When the saved course doesn't hold the page where it was put, that is a 500, not a success. */
	public function test_add_reports_a_course_that_was_not_saved(): void {
		$this->assertError( ( new AddCoursePage( $this->editor() ) )->execute( array( 'bundled_slug' => 'not-a-bundled-page' ) ), 'bsbench_course_not_saved', 500 );
	}

	/** A page moves to the end or the front, whether bundled or a site page. */
	public function test_move_reorders_the_course(): void {
		$this->add_post( 42, 'Contact' );
		$move = new MoveCoursePage( $this->editor() );

		$result = $move->execute(
			array(
				'bundled_slug' => 'article-1',
				'position'     => 5,
			)
		);

		$this->assertSame( array( 'gallery', 'article-2', 'video', 'links', 'article-1' ), $this->saved() );
		$this->assertSame( 5, $result['moved']['position'] );
		$this->assertSame( 'article-1', $result['moved']['slug'] );

		$this->course( 'gallery', 'links', '#42' );
		$front = $move->execute(
			array(
				'post_id'  => 42,
				'position' => 1,
			)
		);

		$this->assertSame( array( '#42', 'gallery', 'links' ), $this->saved() );
		$this->assertSame( 'Contact', $front['moved']['title'] );
	}

	/** A page not in the course, a position past the end, and an unclear choice are refused. */
	public function test_move_refuses_what_it_cannot_do(): void {
		$move = new MoveCoursePage( $this->editor() );

		$this->assertError(
			$move->execute(
				array(
					'bundled_slug' => 'gallery',
					'position'     => 6,
				)
			),
			'bsbench_position_out_of_range',
			400,
			'Position 6 is out of range: choose a position from 1 to 5.'
		);
		$this->assertError( $move->execute( array( 'position' => 1 ) ), 'bsbench_page_choice', 400 );

		$this->course( 'gallery' );

		$this->assertError(
			$move->execute(
				array(
					'bundled_slug' => 'video',
					'position'     => 1,
				)
			),
			'bsbench_page_not_in_course',
			404,
			'“Watch: Nineteen Seconds That Started It All” isn\'t in the course.'
		);
	}

	/** A page leaves the course, as it was; the site page stays on the site. */
	public function test_remove_takes_a_page_out_and_returns_it_as_it_was(): void {
		$this->add_post( 42, 'Contact' );
		$remove = new RemoveCoursePage( $this->editor() );

		$bundled = $remove->execute( array( 'bundled_slug' => 'article-2' ) );

		$this->assertSame( array( 'article-1', 'gallery', 'video', 'links' ), $this->saved() );
		$this->assertSame( 3, $bundled['removed']['position'] );
		$this->assertSame( 'article-2', $bundled['removed']['slug'] );
		$this->assertFalse( $bundled['is_default'] );

		$this->course( 'gallery', '#42' );
		$site = $remove->execute( array( 'post_id' => 42 ) );

		$this->assertSame( array( 'gallery' ), $this->saved() );
		$this->assertSame( 'Contact', $site['removed']['title'] );
		$this->assertArrayHasKey( 42, $this->posts );
	}

	/** A page not in the course, the course's only page, and an unclear choice are refused. */
	public function test_remove_refuses_what_it_cannot_do(): void {
		$remove = new RemoveCoursePage( $this->editor() );

		$this->assertError( $remove->execute( array( 'post_id' => 777 ) ), 'bsbench_page_not_in_course', 404, '“777” isn\'t in the course.' );
		$this->assertError( $remove->execute( array() ), 'bsbench_page_choice', 400 );

		$this->course( 'links' );

		$this->assertError( $remove->execute( array( 'bundled_slug' => 'links' ) ), 'bsbench_last_page', 409, 'The course needs at least one page, so its only page can\'t be removed.' );
		$this->assertSame( array( 'links' ), $this->saved() );
	}

	/**
	 * Builds the find-pages ability over a `get_posts()` that lists every site
	 * post and records the query it was asked.
	 *
	 * @param array<string, mixed> $query Receives the arguments of the search.
	 * @return FindPages The ability.
	 */
	private function find_pages( array &$query ): FindPages {
		Functions\when( 'get_posts' )->alias(
			function ( array $args ) use ( &$query ): array {
				$query = $args;

				return array_map(
					fn ( int $id ): WP_Post => new WP_Post(
						(object) array(
							'ID'          => $id,
							'post_type'   => $this->posts[ $id ]['type'],
							'post_status' => $this->posts[ $id ]['status'],
						)
					),
					array_keys( $this->posts )
				);
			}
		);

		return new FindPages( $this->editor(), array( 'page', 'post' ) );
	}

	/** A search asks for site posts in every status, ranked by relevance; without one, newest first with a stable tie-break. */
	public function test_find_pages_asks_for_posts_in_a_stable_order(): void {
		$query = array();
		$find  = $this->find_pages( $query );

		$find->execute( array( 'search' => 'about' ) );

		$this->assertSame( array( 'page', 'post' ), $query['post_type'] );
		$this->assertSame( array( 'publish', 'draft', 'pending', 'private', 'future' ), $query['post_status'] );
		$this->assertSame( 'about', $query['s'] );
		$this->assertSame( array( 'post_title' ), $query['search_columns'] );
		$this->assertSame( 'relevance', $query['orderby'] );
		$this->assertSame( 20, $query['posts_per_page'] );

		$find->execute( array( 'limit' => 5 ) );

		$this->assertArrayNotHasKey( 's', $query );
		$this->assertArrayNotHasKey( 'search_columns', $query );
		$this->assertSame(
			array(
				'date' => 'DESC',
				'ID'   => 'DESC',
			),
			$query['orderby']
		);
		$this->assertSame( 5, $query['posts_per_page'] );
	}

	/** Each result says whether it can be added and why not, under its plain title. */
	public function test_find_pages_says_whether_each_page_can_be_added(): void {
		$this->add_post( 42, 'About' );
		$this->add_post( 43, 'Pricing', 'draft' );
		$this->add_post( 44, 'Team Notes', 'private', 'page', false );
		$this->add_post( 45, 'Contact' );
		$this->course( 'gallery', '#45' );

		$query = array();
		$pages = $this->find_pages( $query )->execute( array() )['pages'];

		$this->assertSame(
			array(
				'post_id'   => 42,
				'title'     => 'About',
				'post_type' => 'page',
				'status'    => 'publish',
				'url'       => 'https://example.test/?p=42',
				'can_add'   => true,
				'in_course' => false,
				'reason'    => null,
			),
			$pages[0]
		);
		$this->assertFalse( $pages[1]['can_add'] );
		$this->assertNull( $pages[1]['url'] );
		$this->assertStringContainsString( '(its status is draft)', $pages[1]['reason'] );
		$this->assertSame( 'Team Notes', $pages[2]['title'] );
		$this->assertStringContainsString( "because it's private", $pages[2]['reason'] );
		$this->assertFalse( $pages[3]['can_add'] );
		$this->assertTrue( $pages[3]['in_course'] );
		$this->assertSame( '“Contact” is already in the course, at position 2.', $pages[3]['reason'] );
	}

	/** With no matches the list is empty. */
	public function test_find_pages_with_no_matches_is_an_empty_list(): void {
		$query = array();

		$this->assertSame( array( 'pages' => array() ), $this->find_pages( $query )->execute( array() ) );
	}
}
