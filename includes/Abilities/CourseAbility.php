<?php
/**
 * Shared base of the course abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Abilities;

use WP_Error;

use function __;
use function array_column;
use function count;
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * What the abilities that read or edit the surf course have in common: the
 * course as they return it, the input that names a page, and the wording of the
 * errors they share, so a page that can't be added or moved reads the same
 * wherever it is reported.
 */
abstract class CourseAbility implements Ability {

	/**
	 * Stores the collaborator that reads and writes the course.
	 *
	 * @param CourseEditor $editor Reads, checks and saves the course.
	 */
	public function __construct( protected CourseEditor $editor ) {
	}

	/**
	 * Describes the course as the shared output of every course ability.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @return array{pages: array<int, array<string, mixed>>, page_count: int, is_default: bool, bundled_pages: array<int, array<string, mixed>>} The course.
	 */
	protected function course( array $entries ): array {
		return array(
			'pages'         => $this->editor->describe( $entries ),
			'page_count'    => count( $entries ),
			'is_default'    => $this->editor->is_default( $entries ),
			'bundled_pages' => $this->editor->bundled( $entries ),
		);
	}

	/**
	 * Describes the two input properties that name a course page: a site page by
	 * its post id, or a bundled page by its slug.
	 *
	 * @return array<string, array<string, mixed>> The schema properties.
	 */
	protected function page_properties(): array {
		return array(
			'post_id'      => array(
				'type'        => 'integer',
				'minimum'     => 1,
				'description' => __( 'The id of one of the site\'s posts or pages. Give this or bundled_slug, not both.', 'battery-surf-bench' ),
			),
			'bundled_slug' => array(
				'type'        => 'string',
				'enum'        => array_column( $this->editor->bundled( array() ), 'slug' ),
				'description' => __( 'The slug of a bundled page. Give this or post_id, not both.', 'battery-surf-bench' ),
			),
		);
	}

	/**
	 * Reads which page an ability's input names: exactly one of `post_id` and
	 * `bundled_slug`.
	 *
	 * @param array<string, mixed> $input The ability input.
	 * @return array{kind: string, slug?: string, id?: int}|WP_Error The course entry the input names, or an error when it names none or both.
	 */
	protected function entry_from_input( array $input ): array|WP_Error {
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
	 * Finds where a course entry sits in the course.
	 *
	 * @param array<int, array{kind: string, slug?: string, id?: int}> $entries The course entries.
	 * @param array{kind: string, slug?: string, id?: int}             $entry   The entry to find.
	 * @return int|null The entry's position counting from 1, or null when it isn't in the course.
	 */
	protected function position_of_entry( array $entries, array $entry ): ?int {
		return $this->editor->position_of(
			$entries,
			'user' === $entry['kind'] ? $entry['id'] : null,
			'bundled' === $entry['kind'] ? $entry['slug'] : null
		);
	}

	/**
	 * Builds the error for a page that is already in the course.
	 *
	 * @param array{kind: string, slug?: string, id?: int} $entry    The page's course entry.
	 * @param int                                          $position Where the page already sits, counting from 1.
	 * @return WP_Error The error.
	 */
	protected function already_in_course( array $entry, int $position ): WP_Error {
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
	protected function not_in_course( array $entry ): WP_Error {
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
	protected function out_of_range( int $given, int $highest ): WP_Error {
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
	 * Names a course entry for an error message: the page's title, or the post id
	 * when the post doesn't exist.
	 *
	 * @param array{kind: string, slug?: string, id?: int} $entry The course entry.
	 * @return string The page's name.
	 */
	private function name_of( array $entry ): string {
		$title = $this->editor->describe( array( $entry ) )[0]['title'];

		return '' === $title && 'user' === $entry['kind'] ? (string) $entry['id'] : $title;
	}
}
