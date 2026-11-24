<?php
/**
 * Tests for the find-pages ability.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\Ability;
use ErdemBircan\BatterySurfBench\Abilities\Annotations;
use ErdemBircan\BatterySurfBench\Abilities\FindPages;
use WP_Post;

/**
 * Behavioral tests for searching the site's posts and pages: what is asked of
 * WordPress, and what each result says about whether it can join the course.
 */
final class FindPagesTest extends CourseTestCase {

	use AbilityContract;

	/**
	 * The `get_posts()` arguments of the last search.
	 *
	 * @var array<string, mixed>
	 */
	private array $query = array();

	/**
	 * Stubs `get_posts()` to return every site post, in id order.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->query = array();

		Functions\when( 'get_posts' )->alias(
			function ( array $args ): array {
				$this->query = $args;
				$found       = array();

				foreach ( $this->posts as $id => $post ) {
					$found[] = new WP_Post(
						(object) array(
							'ID'          => $id,
							'post_type'   => $post['type'],
							'post_status' => $post['status'],
						)
					);
				}

				return $found;
			}
		);
	}

	/**
	 * Builds the ability under test.
	 *
	 * @return Ability The ability.
	 */
	protected function ability(): Ability {
		return new FindPages( $this->editor(), array( 'page', 'post' ) );
	}

	/**
	 * The annotations of an ability that only reads.
	 *
	 * @return array<string, bool> The annotations.
	 */
	protected function expected_annotations(): array {
		return Annotations::read();
	}

	/**
	 * The ability's registered name.
	 */
	public function test_it_is_named_find_pages(): void {
		$this->assertSame( 'battery-surf-bench/find-pages', $this->ability()->name() );
	}

	/**
	 * Searching asks WordPress for the site's posts and pages in every status
	 * an agent might want to see, ranked by relevance.
	 */
	public function test_a_search_asks_for_posts_and_pages_ranked_by_relevance(): void {
		$this->ability()->execute( array( 'search' => 'about' ) );

		$this->assertSame( array( 'page', 'post' ), $this->query['post_type'] );
		$this->assertSame( array( 'publish', 'draft', 'pending', 'private', 'future' ), $this->query['post_status'] );
		$this->assertSame( 'about', $this->query['s'] );
		$this->assertSame( 'relevance', $this->query['orderby'] );
		$this->assertSame( 'DESC', $this->query['order'] );
		$this->assertSame( 20, $this->query['posts_per_page'] );
	}

	/**
	 * With no search the most recent posts are listed, newest first, and the
	 * search key is left out of the query.
	 */
	public function test_no_search_lists_the_most_recent_posts(): void {
		$this->ability()->execute( array( 'limit' => 5 ) );

		$this->assertArrayNotHasKey( 's', $this->query );
		$this->assertSame( 'date', $this->query['orderby'] );
		$this->assertSame( 5, $this->query['posts_per_page'] );
	}

	/**
	 * A published, public page can be added, and says no reason why not.
	 */
	public function test_a_published_page_can_be_added(): void {
		$this->add_post( 42, 'About' );

		$page = $this->ability()->execute( array() )['pages'][0];

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
			$page
		);
	}

	/**
	 * A draft can't be added; it has no link, and the reason says it isn't published.
	 */
	public function test_a_draft_cannot_be_added_and_has_no_link(): void {
		$this->add_post( 43, 'Pricing', 'draft' );

		$page = $this->ability()->execute( array() )['pages'][0];

		$this->assertFalse( $page['can_add'] );
		$this->assertNull( $page['url'] );
		$this->assertSame( 'draft', $page['status'] );
		$this->assertSame(
			'“Pricing” can\'t be in the course because it isn\'t published (its status is draft). Only published, public posts and pages can be in the course.',
			$page['reason']
		);
	}

	/**
	 * A page already in the course can't be added again, and the reason says where it is.
	 */
	public function test_a_page_already_in_the_course_cannot_be_added_again(): void {
		$this->add_post( 42, 'Contact' );
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

		$page = $this->ability()->execute( array() )['pages'][0];

		$this->assertFalse( $page['can_add'] );
		$this->assertTrue( $page['in_course'] );
		$this->assertSame( '“Contact” is already in the course, at position 2.', $page['reason'] );
	}

	/**
	 * With no matches the list is empty.
	 */
	public function test_no_matches_is_an_empty_list(): void {
		$this->assertSame( array( 'pages' => array() ), $this->ability()->execute( array() ) );
	}

	/**
	 * The search is bounded.
	 */
	public function test_the_limit_is_bounded_to_fifty(): void {
		$limit = $this->ability()->definition()['input_schema']['properties']['limit'];

		$this->assertSame( 1, $limit['minimum'] );
		$this->assertSame( 50, $limit['maximum'] );
	}
}
