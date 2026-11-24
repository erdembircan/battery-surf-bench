<?php
/**
 * Base test case for the course abilities.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Abilities;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Abilities\CourseEditor;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use WP_Post;

/**
 * Stands a small site up for the tests of the course abilities: an option
 * store whose writes run through the course sanitizer the way the registered
 * setting does, and a few posts. The editor under test is the real one, so the
 * abilities are tested through the behavior their consumer sees.
 */
abstract class CourseTestCase extends TestCase {

	/**
	 * Stored options, by name.
	 *
	 * @var array<string, mixed>
	 */
	protected array $options = array();

	/**
	 * Site posts, by id.
	 *
	 * @var array<int, array{type: string, status: string, title: string, viewable: bool}>
	 */
	protected array $posts = array();

	/**
	 * The sanitizer the option store runs saves through.
	 *
	 * @var CourseOrderSanitizer
	 */
	protected CourseOrderSanitizer $sanitizer;

	/**
	 * The catalog of bundled pages.
	 *
	 * @var CourseCatalog
	 */
	protected CourseCatalog $catalog;

	/**
	 * Stubs the WordPress functions the course code calls, backed by `$options` and `$posts`.
	 */
	protected function setUp(): void {
		parent::setUp();

		$this->options   = array();
		$this->posts     = array();
		$this->catalog   = new CourseCatalog( '/plugin/includes/Course/content' );
		$this->sanitizer = new CourseOrderSanitizer( $this->catalog, array( 'page', 'post' ) );

		Functions\when( 'get_option' )->alias(
			fn ( string $name, $default_value = false ) => $this->options[ $name ] ?? $default_value
		);
		Functions\when( 'update_option' )->alias(
			function ( string $name, $value ): bool {
				$this->options[ $name ] = $this->sanitizer->sanitize( $value );

				return true;
			}
		);
		Functions\when( 'absint' )->alias( static fn ( $value ): int => abs( (int) $value ) );
		Functions\when( 'get_post' )->alias(
			function ( int $id ) {
				if ( ! isset( $this->posts[ $id ] ) ) {
					return null;
				}

				return new WP_Post(
					(object) array(
						'ID'          => $id,
						'post_type'   => $this->posts[ $id ]['type'],
						'post_status' => $this->posts[ $id ]['status'],
					)
				);
			}
		);
		Functions\when( 'get_post_status' )->alias( fn ( int $id ) => $this->posts[ $id ]['status'] ?? false );
		Functions\when( 'get_post_type' )->alias( fn ( int $id ) => $this->posts[ $id ]['type'] ?? false );
		Functions\when( 'get_the_title' )->alias( fn ( int $id ) => $this->posts[ $id ]['title'] ?? '' );
		Functions\when( 'get_permalink' )->alias(
			fn ( int $id ) => isset( $this->posts[ $id ] ) ? 'https://example.test/?p=' . $id : false
		);
		Functions\when( 'is_post_publicly_viewable' )->alias(
			function ( $post ): bool {
				$id = $post instanceof WP_Post ? $post->ID : (int) $post;

				return $this->posts[ $id ]['viewable'] ?? false;
			}
		);
	}

	/**
	 * Adds a post to the site.
	 *
	 * @param int    $id       The post id.
	 * @param string $title    The post title.
	 * @param string $status   The post status.
	 * @param string $type     The post type.
	 * @param bool   $viewable Whether visitors can view the post.
	 */
	protected function add_post( int $id, string $title, string $status = 'publish', string $type = 'page', bool $viewable = true ): void {
		$this->posts[ $id ] = array(
			'type'     => $type,
			'status'   => $status,
			'title'    => $title,
			'viewable' => $viewable,
		);
	}

	/**
	 * Saves a course straight into the option store.
	 *
	 * @param array<int, array<string, mixed>> $entries The course entries.
	 */
	protected function set_course( array $entries ): void {
		$this->options['bsbench_course_order'] = $entries;
	}

	/**
	 * Builds the real editor over the stubbed site.
	 *
	 * @return CourseEditor The editor.
	 */
	protected function editor(): CourseEditor {
		return new CourseEditor( 'bsbench_course_order', $this->sanitizer, $this->catalog, array( 'page', 'post' ) );
	}

	/**
	 * Lists the course as short labels (`article-1`, `#42`), for readable assertions.
	 *
	 * @return array<int, string> The saved course.
	 */
	protected function saved_course(): array {
		return array_map(
			static fn ( array $entry ): string => 'bundled' === $entry['kind'] ? $entry['slug'] : '#' . $entry['id'],
			$this->options['bsbench_course_order']
		);
	}
}
