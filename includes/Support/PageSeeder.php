<?php
/**
 * Idempotent page seeder.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Support;

use WP_Query;

use function get_permalink;
use function get_post_meta;
use function md5;
use function update_post_meta;
use function wp_insert_post;
use function wp_update_post;

defined( 'ABSPATH' ) || exit;

/**
 * Creates and maintains the real WordPress pages the plugin ships its content
 * on, keyed by a stable marker rather than a post ID so the operation is
 * idempotent: seeding twice never duplicates a page, and a content change is
 * pushed to the existing page instead of spawning a new one.
 *
 * It is the single component allowed to write these pages into the database;
 * the Course and Cockpit domains hand it a marker, a title and serialized block
 * markup and stay out of `wp_insert_post` themselves. Pages are seeded so they
 * render through the active theme exactly like any other page — no header,
 * footer, script or style of the theme is bypassed.
 */
class PageSeeder {

	/**
	 * Stores the meta keys the seeder marks its pages and tracks their content
	 * with.
	 *
	 * @param string $marker_meta Meta key whose value is the page's seed marker.
	 * @param string $hash_meta   Meta key holding the hash of the seeded content.
	 */
	public function __construct(
		private string $marker_meta,
		private string $hash_meta = '_bsb_content_hash'
	) {
	}

	/**
	 * Ensures a page marked with the given key exists, holds the given content
	 * and requests the given template. Creates the page on first run; on later
	 * runs it only rewrites the page when the content has actually changed, so
	 * repeated boots are cheap and never clobber unrelated edits.
	 *
	 * @param string      $marker   Stable identifier for the page within the plugin.
	 * @param string      $title    Page title (becomes the post title).
	 * @param string      $content  Serialized block markup for the page body.
	 * @param string|null $template Page template slug to request, or null to leave it untouched.
	 * @return int The page's post ID.
	 */
	public function ensure( string $marker, string $title, string $content, ?string $template = null ): int {
		$post_id = $this->find( $marker );
		$hash    = md5( $content );

		if ( null === $post_id ) {
			$post_id = (int) wp_insert_post(
				array(
					'post_title'   => $title,
					'post_content' => $content,
					'post_type'    => 'page',
					'post_status'  => 'publish',
				)
			);
			update_post_meta( $post_id, $this->marker_meta, $marker );
		} elseif ( get_post_meta( $post_id, $this->hash_meta, true ) !== $hash ) {
			wp_update_post(
				array(
					'ID'           => $post_id,
					'post_title'   => $title,
					'post_content' => $content,
				)
			);
		}

		update_post_meta( $post_id, $this->hash_meta, $hash );

		if ( null !== $template ) {
			// An empty template slug means "the theme's default"; WordPress
			// stores that as the literal `default`. A non-empty slug targets a
			// theme template (e.g. a blank-canvas page); themes without it fall
			// back to the default natively, so requesting one is always safe.
			update_post_meta( $post_id, '_wp_page_template', '' === $template ? 'default' : $template );
		}

		return $post_id;
	}

	/**
	 * Resolves a seed marker to the public URL of the page it marks.
	 *
	 * @param string $marker Stable identifier the page was seeded with.
	 * @return string|null The page's permalink, or null when no such page exists.
	 */
	public function url( string $marker ): ?string {
		$post_id = $this->find( $marker );

		if ( null === $post_id ) {
			return null;
		}

		$url = get_permalink( $post_id );

		return false === $url ? null : $url;
	}

	/**
	 * Finds the ID of the page carrying the given seed marker.
	 *
	 * @param string $marker Stable identifier the page was seeded with.
	 * @return int|null The matching page's ID, or null when none exists.
	 */
	private function find( string $marker ): ?int {
		$query = new WP_Query(
			array(
				'post_type'              => 'page',
				'post_status'            => 'any',
				'posts_per_page'         => 1,
				'fields'                 => 'ids',
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- low-frequency lookup by the plugin's own seed marker (once per page on boot / URL resolution).
				'meta_query'             => array(
					array(
						'key'   => $this->marker_meta,
						'value' => $marker,
					),
				),
			)
		);

		$ids = $query->posts;

		return empty( $ids ) ? null : (int) $ids[0];
	}
}
