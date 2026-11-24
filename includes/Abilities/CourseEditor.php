<?php
/**
 * Surf course reading and editing for the AI agent abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use WP_Error;
use WP_Post;

use function __;
use function array_keys;
use function array_map;
use function count;
use function get_option;
use function get_permalink;
use function get_post;
use function get_post_type;
use function get_the_title;
use function html_entity_decode;
use function in_array;
use function is_post_publicly_viewable;
use function sprintf;
use function update_option;

defined( 'ABSPATH' ) || exit;

/**
 * Reads and writes the surf course for the abilities that manage it, and
 * describes it in the shape they return.
 *
 * The course is stored as the `bsbench_course_order` option: an ordered list
 * of `{kind: 'bundled', slug}` and `{kind: 'user', id}` entries. Every read and
 * write goes through {@see CourseOrderSanitizer}, the same gate the settings
 * screen saves through, so an agent can never store an entry the screen
 * wouldn't accept. This class also owns the error wording the course abilities
 * share, so a page that can't be added reads the same wherever it's reported.
 */
class CourseEditor {

	/**
	 * Stores the option the course is saved under, the sanitizer that validates
	 * it, the catalog of bundled pages, and the post types a site page may be
	 * added from.
	 *
	 * @param string               $option_name           Name of the option the course is saved under.
	 * @param CourseOrderSanitizer $sanitizer             Validates the saved course.
	 * @param CourseCatalog        $catalog               Source of the bundled pages.
	 * @param array<int, string>   $selectable_post_types Post types a site page may belong to.
	 */
	public function __construct(
		private string $option_name,
		private CourseOrderSanitizer $sanitizer,
		private CourseCatalog $catalog,
		private array $selectable_post_types
	) {
	}

	/**
	 * Reads the saved course, validated.
	 *
	 * @return array<int, array{kind: string, slug?: string, id?: int}> The course entries, in visit order.
	 */
	public function entries(): array {
		return $this->sanitizer->sanitize( get_option( $this->option_name, $this->sanitizer->default_order() ) );
	}

	/**
	 * Saves a course and reads back what was stored, since the sanitizer runs
	 * again on the way in.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries to save.
	 * @return array<int, array{kind: string, slug?: string, id?: int}> The course as stored.
	 */
	public function save( array $entries ): array {
		update_option( $this->option_name, $entries );

		return $this->entries();
	}

	/**
	 * Replaces the saved course with the default one: the bundled pages in their
	 * original order.
	 *
	 * @return array<int, array{kind: string, slug?: string, id?: int}> The course as stored.
	 */
	public function reset(): array {
		return $this->save( $this->sanitizer->default_order() );
	}

	/**
	 * Describes course entries as the pages list the abilities return.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @return array<int, array<string, mixed>> The described pages, numbered from 1.
	 */
	public function describe( array $entries ): array {
		$pages = array();

		foreach ( $entries as $index => $entry ) {
			$pages[] = $this->describe_entry( $entry, $index + 1 );
		}

		return $pages;
	}

	/**
	 * Lists every bundled page and whether the course includes it.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @return array<int, array{slug: string, title: string, in_course: bool}> The bundled pages.
	 */
	public function bundled( array $entries ): array {
		$bundled = array();

		foreach ( $this->catalog->titles() as $slug => $title ) {
			$bundled[] = array(
				'slug'      => (string) $slug,
				'title'     => $title,
				'in_course' => null !== $this->position_of( $entries, null, (string) $slug ),
			);
		}

		return $bundled;
	}

	/**
	 * Whether a course is the default one: the bundled pages in their original order.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @return bool Whether the course is the default.
	 */
	public function is_default( array $entries ): bool {
		return $entries === $this->sanitizer->default_order();
	}

	/**
	 * Finds where a page sits in the course.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @param int|null                                                 $post_id The post id of a site page, or null.
	 * @param string|null                                              $slug    The slug of a bundled page, or null.
	 * @return int|null The page's position counting from 1, or null when it isn't in the course.
	 */
	public function position_of( array $entries, ?int $post_id, ?string $slug ): ?int {
		foreach ( $entries as $index => $entry ) {
			if ( null !== $post_id && 'user' === $entry['kind'] && $post_id === $entry['id'] ) {
				return $index + 1;
			}

			if ( null !== $slug && 'bundled' === $entry['kind'] && $slug === $entry['slug'] ) {
				return $index + 1;
			}
		}

		return null;
	}

	/**
	 * Checks whether a post can join the course: it must exist, be a post or page,
	 * be published, and be viewable by visitors.
	 *
	 * @param int $post_id The post id.
	 * @return true|WP_Error True when the post is eligible, otherwise an error saying why not.
	 */
	public function eligibility( int $post_id ): bool|WP_Error {
		$post = get_post( $post_id );

		if ( ! $post instanceof WP_Post ) {
			return new WP_Error(
				'bsbench_page_not_found',
				sprintf(
					/* translators: %d: A post id. */
					__( "There's no post or page with the id %d.", 'battery-surf-bench' ),
					$post_id
				),
				array( 'status' => 404 )
			);
		}

		$title = $this->title_of( $post_id );

		if ( ! in_array( $post->post_type, $this->selectable_post_types, true ) ) {
			return new WP_Error(
				'bsbench_page_wrong_type',
				sprintf(
					/* translators: %s: A post title. */
					__( '“%s” can\'t be in the course: only posts and pages can.', 'battery-surf-bench' ),
					$title
				),
				array( 'status' => 400 )
			);
		}

		if ( 'publish' !== $post->post_status ) {
			return new WP_Error(
				'bsbench_page_not_published',
				sprintf(
					/* translators: 1: A post title. 2: The post's status, such as draft or private. */
					__( '“%1$s” can\'t be in the course because it isn\'t published (its status is %2$s). Only published, public posts and pages can be in the course.', 'battery-surf-bench' ),
					$title,
					$post->post_status
				),
				array( 'status' => 400 )
			);
		}

		if ( ! is_post_publicly_viewable( $post ) ) {
			return new WP_Error(
				'bsbench_page_not_public',
				sprintf(
					/* translators: %s: A post title. */
					__( '“%s” can\'t be in the course because visitors can\'t view it. Only published, public posts and pages can be in the course.', 'battery-surf-bench' ),
					$title
				),
				array( 'status' => 400 )
			);
		}

		return true;
	}

	/**
	 * Reads which page an ability's input names: exactly one of `post_id` and
	 * `bundled_slug`.
	 *
	 * @param array<string, mixed> $input The ability input.
	 * @return array{kind: string, slug?: string, id?: int}|WP_Error The course entry the input names, or an error when it names none or both.
	 */
	public function entry_from_input( array $input ): array|WP_Error {
		$has_post   = isset( $input['post_id'] );
		$has_bundle = isset( $input['bundled_slug'] ) && '' !== $input['bundled_slug'];

		if ( $has_post === $has_bundle ) {
			return new WP_Error(
				'bsbench_page_choice',
				__( 'Name exactly one page: a post_id or a bundled_slug.', 'battery-surf-bench' ),
				array( 'status' => 400 )
			);
		}

		if ( $has_post ) {
			return array(
				'kind' => 'user',
				'id'   => (int) $input['post_id'],
			);
		}

		return array(
			'kind' => 'bundled',
			'slug' => (string) $input['bundled_slug'],
		);
	}

	/**
	 * Describes the two input properties that name a course page: a site page by
	 * its post id, or a bundled page by its slug.
	 *
	 * @return array<string, array<string, mixed>> The schema properties.
	 */
	public function page_properties(): array {
		return array(
			'post_id'      => array(
				'type'        => 'integer',
				'minimum'     => 1,
				'description' => __( 'The id of one of the site\'s posts or pages. Give this or bundled_slug, not both.', 'battery-surf-bench' ),
			),
			'bundled_slug' => array(
				'type'        => 'string',
				'enum'        => array_map( 'strval', array_keys( $this->catalog->titles() ) ),
				'description' => __( 'The slug of a bundled page. Give this or post_id, not both.', 'battery-surf-bench' ),
			),
		);
	}

	/**
	 * Finds where a course entry sits in the course.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @param array{kind: string, slug?: string, id?: int}             $entry   The entry to find.
	 * @return int|null The entry's position counting from 1, or null when it isn't in the course.
	 */
	public function position_of_entry( array $entries, array $entry ): ?int {
		return $this->position_of(
			$entries,
			'user' === $entry['kind'] ? $entry['id'] : null,
			'bundled' === $entry['kind'] ? $entry['slug'] : null
		);
	}

	/**
	 * Describes the course as the shared output of every course ability.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @return array{pages: array<int, array<string, mixed>>, page_count: int, is_default: bool, bundled_pages: array<int, array<string, mixed>>} The course.
	 */
	public function course( array $entries ): array {
		return array(
			'pages'         => $this->describe( $entries ),
			'page_count'    => count( $entries ),
			'is_default'    => $this->is_default( $entries ),
			'bundled_pages' => $this->bundled( $entries ),
		);
	}

	/**
	 * Describes one course entry, wherever it sits.
	 *
	 * @param array{kind: string, slug?: string, id?: int} $entry    The course entry.
	 * @param int                                          $position Its position counting from 1.
	 * @return array<string, mixed> The described page.
	 */
	public function describe_entry( array $entry, int $position ): array {
		if ( 'bundled' === $entry['kind'] ) {
			return array(
				'position'  => $position,
				'kind'      => 'bundled',
				'slug'      => $entry['slug'],
				'post_id'   => null,
				'title'     => $this->catalog->titles()[ $entry['slug'] ] ?? $entry['slug'],
				'post_type' => null,
				'url'       => null,
			);
		}

		$post_type = get_post_type( $entry['id'] );
		$url       = get_permalink( $entry['id'] );

		return array(
			'position'  => $position,
			'kind'      => 'user',
			'slug'      => null,
			'post_id'   => $entry['id'],
			'title'     => $this->title_of( $entry['id'] ),
			'post_type' => false === $post_type ? null : $post_type,
			'url'       => false === $url ? null : $url,
		);
	}

	/**
	 * Names a course entry for an error message: the page's title, or the post id
	 * when the post doesn't exist.
	 *
	 * @param array{kind: string, slug?: string, id?: int} $entry The course entry.
	 * @return string The page's name.
	 */
	public function name_of( array $entry ): string {
		if ( 'bundled' === $entry['kind'] ) {
			return $this->catalog->titles()[ $entry['slug'] ] ?? $entry['slug'];
		}

		$title = $this->title_of( $entry['id'] );

		return '' === $title ? (string) $entry['id'] : $title;
	}

	/**
	 * Builds the error for a page that is already in the course.
	 *
	 * @param array{kind: string, slug?: string, id?: int} $entry    The page's course entry.
	 * @param int                                          $position Where the page already sits, counting from 1.
	 * @return WP_Error The error.
	 */
	public function already_in_course( array $entry, int $position ): WP_Error {
		return new WP_Error(
			'bsbench_page_in_course',
			sprintf(
				/* translators: 1: A page title. 2: Its position in the course. */
				__( '“%1$s” is already in the course, at position %2$d.', 'battery-surf-bench' ),
				$this->name_of( $entry ),
				$position
			),
			array( 'status' => 409 )
		);
	}

	/**
	 * Builds the error for a page that isn't in the course.
	 *
	 * @param array{kind: string, slug?: string, id?: int} $entry The page's course entry.
	 * @return WP_Error The error.
	 */
	public function not_in_course( array $entry ): WP_Error {
		return new WP_Error(
			'bsbench_page_not_in_course',
			sprintf(
				/* translators: %s: A page title, or a post id. */
				__( '“%s” isn\'t in the course.', 'battery-surf-bench' ),
				$this->name_of( $entry )
			),
			array( 'status' => 404 )
		);
	}

	/**
	 * Builds the error for a position outside the course.
	 *
	 * @param int $given   The position that was given.
	 * @param int $highest The highest position allowed.
	 * @return WP_Error The error.
	 */
	public function out_of_range( int $given, int $highest ): WP_Error {
		return new WP_Error(
			'bsbench_position_out_of_range',
			sprintf(
				/* translators: 1: The position that was given. 2: The highest position allowed. */
				__( 'Position %1$d is out of range: choose a position from 1 to %2$d.', 'battery-surf-bench' ),
				$given,
				$highest
			),
			array( 'status' => 400 )
		);
	}

	/**
	 * Reads a post's title as plain text.
	 *
	 * @param int $post_id The post id.
	 * @return string The title, with HTML entities decoded.
	 */
	private function title_of( int $post_id ): string {
		return html_entity_decode( get_the_title( $post_id ), ENT_QUOTES, 'UTF-8' );
	}
}
