<?php
/**
 * Surf-course order sanitizer.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use function absint;
use function get_post_status;
use function get_post_type;
use function in_array;
use function is_array;
use function is_post_publicly_viewable;
use function is_string;

defined( 'ABSPATH' ) || exit;

/**
 * Validates and heals the saved surf-course order: an ordered, heterogeneous
 * list of `{kind: 'bundled', slug}` and `{kind: 'user', id}` entries describing
 * the surfer's full page sequence. Bundled entries are the pages the plugin
 * ships ({@see CourseCatalog}); user entries are posts or pages the site owner
 * chose from the settings screen.
 *
 * Bundled pages can never be dropped from the sequence, so a saved order that
 * is missing one — because it predates a catalog change, or was tampered with
 * — is healed by appending the missing entries in catalog order. User entries
 * are dropped when they no longer resolve to an existing, published, publicly
 * viewable post of a selectable type, so a page that was trashed, unpublished
 * or deleted quietly falls out of the rotation instead of breaking the option.
 */
class CourseOrderSanitizer {

	/**
	 * Stores the catalog bundled slugs are validated against and the post types
	 * a user entry is allowed to resolve to.
	 *
	 * @param CourseCatalog $catalog             Source of the bundled page definitions.
	 * @param array<string> $selectable_post_types Post types a user entry may belong to.
	 */
	public function __construct(
		private CourseCatalog $catalog,
		private array $selectable_post_types
	) {
	}

	/**
	 * Builds the default order: the bundled pages in catalog order, before any
	 * user page has been added.
	 *
	 * @return array<int, array{kind: string, slug?: string, id?: int}> The default order.
	 */
	public function default_order(): array {
		$order = array();

		foreach ( $this->catalog->pages() as $page ) {
			$order[] = array(
				'kind' => 'bundled',
				'slug' => $page->slug(),
			);
		}

		return $order;
	}

	/**
	 * Validates a saved (or submitted) order: drops entries that no longer
	 * resolve or are malformed, drops duplicates, and re-inserts any bundled
	 * page missing from the result so bundled pages can never be lost.
	 *
	 * @param mixed $value The raw value being saved for the option.
	 * @return array<int, array{kind: string, slug?: string, id?: int}> The sanitized, healed order.
	 */
	public function sanitize( mixed $value ): array {
		if ( ! is_array( $value ) ) {
			return $this->default_order();
		}

		$seen_slugs = array();
		$seen_ids   = array();
		$order      = array();

		foreach ( $value as $entry ) {
			if ( ! is_array( $entry ) || ! isset( $entry['kind'] ) ) {
				continue;
			}

			if ( 'bundled' === $entry['kind'] ) {
				$slug = $this->sanitized_bundled_slug( $entry, $seen_slugs );

				if ( null === $slug ) {
					continue;
				}

				$seen_slugs[ $slug ] = true;
				$order[]             = array(
					'kind' => 'bundled',
					'slug' => $slug,
				);
				continue;
			}

			if ( 'user' === $entry['kind'] ) {
				$id = $this->sanitized_user_id( $entry, $seen_ids );

				if ( null === $id ) {
					continue;
				}

				$seen_ids[ $id ] = true;
				$order[]         = array(
					'kind' => 'user',
					'id'   => $id,
				);
			}
		}

		foreach ( $this->catalog->pages() as $page ) {
			if ( ! isset( $seen_slugs[ $page->slug() ] ) ) {
				$order[] = array(
					'kind' => 'bundled',
					'slug' => $page->slug(),
				);
			}
		}

		return $order;
	}

	/**
	 * Validates a bundled entry's slug against the catalog and the slugs
	 * already accepted in this pass.
	 *
	 * @param array<string, mixed> $entry      The raw entry.
	 * @param array<string, bool>  $seen_slugs Slugs already accepted in this pass.
	 * @return string|null The valid slug, or null when the entry is invalid or a duplicate.
	 */
	private function sanitized_bundled_slug( array $entry, array $seen_slugs ): ?string {
		if ( ! isset( $entry['slug'] ) || ! is_string( $entry['slug'] ) ) {
			return null;
		}

		$slug = $entry['slug'];

		if ( isset( $seen_slugs[ $slug ] ) || null === $this->catalog->find( $slug ) ) {
			return null;
		}

		return $slug;
	}

	/**
	 * Validates a user entry's post id: it must be a real, published, publicly
	 * viewable post of a selectable type, and not already accepted in this pass.
	 *
	 * @param array<string, mixed> $entry    The raw entry.
	 * @param array<int, bool>     $seen_ids Post ids already accepted in this pass.
	 * @return int|null The valid post id, or null when the entry is invalid or a duplicate.
	 */
	private function sanitized_user_id( array $entry, array $seen_ids ): ?int {
		if ( ! isset( $entry['id'] ) ) {
			return null;
		}

		$id = absint( $entry['id'] );

		if ( 0 === $id || isset( $seen_ids[ $id ] ) || ! $this->is_selectable_post( $id ) ) {
			return null;
		}

		return $id;
	}

	/**
	 * Whether a post id is a real, published, publicly viewable post of a
	 * selectable type — the bar a user-added page must clear to stay saved.
	 *
	 * @param int $id The post id to check.
	 * @return bool Whether the post is eligible to stay in the sequence.
	 */
	private function is_selectable_post( int $id ): bool {
		$status = get_post_status( $id );

		if ( false === $status || 'publish' !== $status ) {
			return false;
		}

		$post_type = get_post_type( $id );

		if ( false === $post_type || ! in_array( $post_type, $this->selectable_post_types, true ) ) {
			return false;
		}

		return is_post_publicly_viewable( $id );
	}
}
