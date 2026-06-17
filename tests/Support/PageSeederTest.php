<?php
/**
 * Tests for the page seeder.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Support;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Support\PageSeeder;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

/**
 * The seeder's contract is idempotency: a marked page is created once, rewritten
 * only when its content actually changes, and resolved back to a URL. The tests
 * stage the WP_Query stub to say whether the page already exists and assert the
 * observable writes the seeder makes (insert/update/meta), not how it queries.
 */
final class PageSeederTest extends TestCase {

	private const CONTENT = '<!-- wp:bsb/cockpit /-->';

	/**
	 * Resets the staged query result before each test.
	 */
	protected function setUp(): void {
		parent::setUp();
		\WP_Query::$staged_posts = array();
	}

	/**
	 * Stages the post IDs the next WP_Query should return.
	 *
	 * @param array<int, int> $ids Post IDs the query resolves to.
	 */
	private function stage_existing( array $ids ): void {
		\WP_Query::$staged_posts = $ids;
	}

	/**
	 * Builds a seeder marking pages with a known meta key.
	 *
	 * @return PageSeeder The seeder under test.
	 */
	private function seeder(): PageSeeder {
		return new PageSeeder( '_bsb_seeded' );
	}

	/**
	 * When no marked page exists, the seeder creates a published page, marks it,
	 * stamps its content hash and records the requested template — returning the
	 * new page's ID.
	 */
	public function test_ensure_creates_a_marked_page_when_absent(): void {
		$meta = array();
		Functions\when( 'update_post_meta' )->alias(
			static function ( int $id, string $key, $value ) use ( &$meta ): bool {
				$meta[ $key ] = $value;

				return true;
			}
		);
		Functions\expect( 'wp_insert_post' )
			->once()
			->with(
				Mockery::on(
					static fn ( array $post ): bool =>
						'page' === $post['post_type']
						&& 'publish' === $post['post_status']
						&& 'Cockpit' === $post['post_title']
						&& self::CONTENT === $post['post_content']
				)
			)
			->andReturn( 7 );

		$id = $this->seeder()->ensure( 'cockpit', 'Cockpit', self::CONTENT, '' );

		$this->assertSame( 7, $id );
		$this->assertSame( 'cockpit', $meta['_bsb_seeded'] );
		$this->assertSame( md5( self::CONTENT ), $meta['_bsb_content_hash'] );
		// An empty requested template is stored as the literal theme default.
		$this->assertSame( 'default', $meta['_wp_page_template'] );
	}

	/**
	 * When a marked page exists but its stored content hash differs, the seeder
	 * rewrites the existing page instead of creating a new one.
	 */
	public function test_ensure_updates_existing_page_when_content_changed(): void {
		$this->stage_existing( array( 7 ) );
		Functions\when( 'get_post_meta' )->justReturn( 'a-stale-hash' );
		Functions\when( 'update_post_meta' )->justReturn( true );
		Functions\expect( 'wp_insert_post' )->never();
		Functions\expect( 'wp_update_post' )
			->once()
			->with( Mockery::on( static fn ( array $post ): bool => 7 === $post['ID'] ) );

		$this->assertSame( 7, $this->seeder()->ensure( 'cockpit', 'Cockpit', self::CONTENT, '' ) );
	}

	/**
	 * When the existing page already holds the current content, the seeder
	 * leaves it untouched — repeated boots are cheap and never clobber edits.
	 */
	public function test_ensure_skips_update_when_content_unchanged(): void {
		$this->stage_existing( array( 7 ) );
		Functions\when( 'get_post_meta' )->justReturn( md5( self::CONTENT ) );
		Functions\when( 'update_post_meta' )->justReturn( true );
		Functions\expect( 'wp_insert_post' )->never();
		Functions\expect( 'wp_update_post' )->never();

		$this->assertSame( 7, $this->seeder()->ensure( 'cockpit', 'Cockpit', self::CONTENT, '' ) );
	}

	/**
	 * A marker resolves to the permalink of the page it marks.
	 */
	public function test_url_resolves_a_markers_permalink(): void {
		$this->stage_existing( array( 9 ) );
		Functions\when( 'get_permalink' )->justReturn( 'https://example.test/cockpit' );

		$this->assertSame( 'https://example.test/cockpit', $this->seeder()->url( 'cockpit' ) );
	}

	/**
	 * An unseeded marker resolves to null rather than a bogus URL.
	 */
	public function test_url_is_null_for_an_unseeded_marker(): void {
		$this->assertNull( $this->seeder()->url( 'cockpit' ) );
	}
}
