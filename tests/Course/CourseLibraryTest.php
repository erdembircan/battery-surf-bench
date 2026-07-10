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
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The library lists the surfer's full page sequence with the front-end URL
 * that serves each one — the list the cockpit surfs. The tests run it against
 * the real catalog and a real sanitizer (so healing/dropping behaviour is
 * exercised end to end), with the WordPress option, URL and post lookups
 * stubbed to a predictable form.
 */
final class CourseLibraryTest extends TestCase {

	private const PARAM  = 'bsbSessionPage';
	private const OPTION = 'bsb_course_order';

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
	 * Builds a library over the real catalog and a real sanitizer.
	 *
	 * @return CourseLibrary The library under test.
	 */
	private function library(): CourseLibrary {
		$catalog   = new CourseCatalog( '/plugin/includes/Course/content' );
		$sanitizer = new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) );

		return new CourseLibrary( $catalog, self::PARAM, self::OPTION, $sanitizer );
	}

	/**
	 * Stubs the WordPress post lookups the sanitizer validates a user entry
	 * against.
	 *
	 * @param array<int, array{status?: string, type?: string, viewable?: bool}> $posts Post id => attributes.
	 */
	private function stub_posts( array $posts ): void {
		Functions\when( 'get_post_status' )->alias(
			static fn ( int $id ) => $posts[ $id ]['status'] ?? false
		);
		Functions\when( 'get_post_type' )->alias(
			static fn ( int $id ) => $posts[ $id ]['type'] ?? false
		);
		Functions\when( 'is_post_publicly_viewable' )->alias(
			static fn ( int $id ) => $posts[ $id ]['viewable'] ?? false
		);
	}

	/**
	 * No saved option falls back to the sanitizer's default — the five bundled
	 * pages in catalog order — identical to the library's behavior before any
	 * user page has ever been added.
	 */
	public function test_no_option_reports_the_five_bundled_pages_in_order(): void {
		Functions\when( 'get_option' )->alias( static fn ( string $name, $fallback = false ) => $fallback );

		$links = $this->library()->links();

		$this->assertCount( 5, $links );
		$this->assertSame(
			array(
				'slug'  => 'article-1',
				'title' => 'The Hidden Cost of a Browser Tab',
				'url'   => 'https://example.test/?bsbSessionPage=article-1',
			),
			$links[0]
		);

		foreach ( $links as $link ) {
			$this->assertSame(
				'https://example.test/?bsbSessionPage=' . $link['slug'],
				$link['url']
			);
			$this->assertNotSame( '', $link['title'] );
		}
	}

	/**
	 * The saved order is emitted exactly in saved order: a bundled entry as the
	 * router URL (`?bsbSessionPage=<slug>`), a user entry as its own real
	 * permalink and title. Bundled pages missing from the saved order are
	 * healed in afterward, exactly as the sanitizer heals them.
	 */
	public function test_emits_the_saved_sequence_in_order(): void {
		$this->stub_posts(
			array(
				42 => array(
					'status'   => 'publish',
					'type'     => 'page',
					'viewable' => true,
				),
			)
		);

		Functions\when( 'get_option' )->justReturn(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
				array(
					'kind' => 'bundled',
					'slug' => 'article-1',
				),
			)
		);
		Functions\when( 'get_the_title' )->justReturn( 'My Custom Page' );
		Functions\when( 'get_permalink' )->justReturn( 'https://example.test/my-custom-page/' );

		$links = $this->library()->links();

		// Saved order first (user page, then article-1), then the four
		// remaining bundled pages healed in at the end, in catalog order.
		$this->assertCount( 6, $links );
		$this->assertSame(
			array(
				'slug'  => 'user-42',
				'title' => 'My Custom Page',
				'url'   => 'https://example.test/my-custom-page/',
			),
			$links[0]
		);
		$this->assertSame( 'article-1', $links[1]['slug'] );
		$this->assertSame(
			array( 'gallery', 'article-2', 'video', 'links' ),
			array_column( array_slice( $links, 2 ), 'slug' )
		);
	}

	/**
	 * A user id that no longer resolves to an eligible post (the sanitizer's
	 * job) never reaches the emitted links — only the healed bundled pages
	 * remain.
	 */
	public function test_drops_ineligible_user_ids(): void {
		$this->stub_posts( array( 99 => array( 'status' => 'trash' ) ) );

		Functions\when( 'get_option' )->justReturn(
			array(
				array(
					'kind' => 'user',
					'id'   => 99,
				),
			)
		);

		$links = $this->library()->links();

		$this->assertCount( 5, $links );
		foreach ( $links as $link ) {
			$this->assertFalse( str_starts_with( $link['slug'], 'user-' ) );
		}
	}
}
