<?php
/**
 * Tests for the surf-course order sanitizer.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * The sanitizer is the option's only gate between whatever gets POSTed and
 * what is actually saved: it must validate every entry and drop what no
 * longer resolves — including a bundled slug the catalog no longer has — but
 * a bundled page a site owner deliberately removed stays removed; only
 * `default_order()` (a fresh install's starting point) has every bundled page
 * present by construction.
 */
final class CourseOrderSanitizerTest extends TestCase {

	/**
	 * Builds a sanitizer over the real catalog (a fixed, known set of bundled
	 * slugs) restricted to pages and posts as selectable user types.
	 *
	 * @return CourseOrderSanitizer The sanitizer under test.
	 */
	private function sanitizer(): CourseOrderSanitizer {
		return new CourseOrderSanitizer( new CourseCatalog( __DIR__ ), array( 'page', 'post' ) );
	}

	/**
	 * Stubs the WordPress post lookups a user entry is validated against.
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
	 * The default order is every bundled page, in catalog order, before any
	 * user page has been added.
	 */
	public function test_default_order_is_the_bundled_catalog_in_order(): void {
		$order = $this->sanitizer()->default_order();

		$this->assertSame(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'article-1',
				),
				array(
					'kind' => 'bundled',
					'slug' => 'gallery',
				),
				array(
					'kind' => 'bundled',
					'slug' => 'article-2',
				),
				array(
					'kind' => 'bundled',
					'slug' => 'video',
				),
				array(
					'kind' => 'bundled',
					'slug' => 'links',
				),
			),
			$order
		);
	}

	/**
	 * A non-array value (e.g. the option was never saved, or was corrupted)
	 * falls back to the default order rather than tripping on it.
	 */
	public function test_sanitize_falls_back_to_default_for_a_non_array_value(): void {
		$this->assertSame( $this->sanitizer()->default_order(), $this->sanitizer()->sanitize( 'not-an-array' ) );
		$this->assertSame( $this->sanitizer()->default_order(), $this->sanitizer()->sanitize( null ) );
	}

	/**
	 * A well-formed order made only of bundled entries and valid user entries
	 * passes through unchanged (aside from re-ordering to the input's order).
	 */
	public function test_sanitize_keeps_a_well_formed_order(): void {
		$this->stub_posts(
			array(
				42 => array(
					'status'   => 'publish',
					'type'     => 'page',
					'viewable' => true,
				),
			)
		);

		$order = array(
			array(
				'kind' => 'bundled',
				'slug' => 'article-1',
			),
			array(
				'kind' => 'user',
				'id'   => 42,
			),
			array(
				'kind' => 'bundled',
				'slug' => 'gallery',
			),
			array(
				'kind' => 'bundled',
				'slug' => 'article-2',
			),
			array(
				'kind' => 'bundled',
				'slug' => 'video',
			),
			array(
				'kind' => 'bundled',
				'slug' => 'links',
			),
		);

		$this->assertSame( $order, $this->sanitizer()->sanitize( $order ) );
	}

	/**
	 * A saved order missing a bundled page — because a site owner removed it
	 * from the settings screen, or it predates a catalog change — is returned
	 * exactly as saved: the missing page stays missing. Bundled pages are no
	 * longer force-reinserted on every read; a site owner can permanently
	 * shrink the sequence, and re-add a removed bundled page from the
	 * settings screen's "Built-in" browse filter whenever they choose to.
	 */
	public function test_sanitize_leaves_a_missing_bundled_page_missing(): void {
		$order = array(
			array(
				'kind' => 'bundled',
				'slug' => 'article-1',
			),
			array(
				'kind' => 'bundled',
				'slug' => 'gallery',
			),
			// 'article-2', 'video' and 'links' are absent — deliberately removed,
			// not merely stale — and must stay absent.
		);

		$this->assertSame( $order, $this->sanitizer()->sanitize( $order ) );
	}

	/**
	 * An order with every bundled page removed sanitizes down to an empty
	 * array rather than being backfilled — the sequence can be shrunk all the
	 * way to nothing.
	 */
	public function test_sanitize_allows_every_bundled_page_to_be_removed(): void {
		$this->assertSame( array(), $this->sanitizer()->sanitize( array() ) );
	}

	/**
	 * A bundled entry naming a slug the catalog no longer has is dropped —
	 * it never becomes a "user" entry, is never mistaken for a deliberate
	 * removal of a real page, and otherwise never survives.
	 */
	public function test_sanitize_drops_an_unknown_bundled_slug(): void {
		$order = array(
			array(
				'kind' => 'bundled',
				'slug' => 'not-a-real-page',
			),
		);

		$sanitized = $this->sanitizer()->sanitize( $order );

		$this->assertSame( array(), $sanitized );
	}

	/**
	 * A user entry whose post id no longer resolves to an existing, published,
	 * publicly viewable post of a selectable type is dropped.
	 */
	public function test_sanitize_drops_ids_that_no_longer_resolve(): void {
		$this->stub_posts(
			array(
				1 => array( 'status' => false ), // Deleted.
				2 => array(
					'status'   => 'draft',
					'type'     => 'page',
					'viewable' => true,
				), // Unpublished.
				3 => array(
					'status'   => 'publish',
					'type'     => 'attachment',
					'viewable' => true,
				), // Not a selectable type.
				4 => array(
					'status'   => 'publish',
					'type'     => 'page',
					'viewable' => false,
				), // Not publicly viewable.
				5 => array(
					'status'   => 'publish',
					'type'     => 'post',
					'viewable' => true,
				), // Valid.
			)
		);

		$order = array(
			array(
				'kind' => 'user',
				'id'   => 1,
			),
			array(
				'kind' => 'user',
				'id'   => 2,
			),
			array(
				'kind' => 'user',
				'id'   => 3,
			),
			array(
				'kind' => 'user',
				'id'   => 4,
			),
			array(
				'kind' => 'user',
				'id'   => 5,
			),
		);

		$sanitized = $this->sanitizer()->sanitize( $order );
		$user_ids  = array_column( array_filter( $sanitized, static fn ( $e ) => 'user' === $e['kind'] ), 'id' );

		$this->assertSame( array( 5 ), $user_ids );
	}

	/**
	 * Duplicate entries — the same bundled slug or user id appearing twice —
	 * are deduplicated to their first occurrence.
	 */
	public function test_sanitize_dedupes_repeated_entries(): void {
		$this->stub_posts(
			array(
				7 => array(
					'status'   => 'publish',
					'type'     => 'page',
					'viewable' => true,
				),
			)
		);

		$order = array(
			array(
				'kind' => 'bundled',
				'slug' => 'article-1',
			),
			array(
				'kind' => 'bundled',
				'slug' => 'article-1',
			),
			array(
				'kind' => 'user',
				'id'   => 7,
			),
			array(
				'kind' => 'user',
				'id'   => 7,
			),
		);

		$sanitized = $this->sanitizer()->sanitize( $order );

		$this->assertSame(
			1,
			count( array_filter( $sanitized, static fn ( $e ) => 'bundled' === $e['kind'] && 'article-1' === $e['slug'] ) )
		);
		$this->assertSame(
			1,
			count( array_filter( $sanitized, static fn ( $e ) => 'user' === $e['kind'] && 7 === $e['id'] ) )
		);
	}

	/**
	 * Malformed entries (missing keys, an unrecognized `kind`, or not even an
	 * array) are dropped rather than causing a fatal error, yielding an empty
	 * array — there is no backfill to fall back on any more, only
	 * {@see default_order()} starts with every bundled page present.
	 */
	public function test_sanitize_drops_malformed_entries(): void {
		$order = array(
			'not-an-array',
			array( 'kind' => 'mystery' ),
			array( 'kind' => 'bundled' ), // Missing slug.
			array( 'kind' => 'user' ), // Missing id.
			array(),
		);

		$this->assertSame( array(), $this->sanitizer()->sanitize( $order ) );
	}
}
