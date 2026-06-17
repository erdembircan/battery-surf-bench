<?php
/**
 * Course catalog.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use function file_get_contents;
use function is_readable;
use function trailingslashit;

defined( 'ABSPATH' ) || exit;

/**
 * The single source of truth for which pages make up the surf course and what
 * each one contains. It pairs a static list of page definitions with the block
 * markup each one ships, loaded from the plugin's bundled content files.
 *
 * The catalog is deliberately storage-agnostic: it produces {@see CoursePage}
 * value objects and never touches the database. The {@see CourseLibrary} turns
 * those definitions into real WordPress pages; keeping the two apart means the
 * course can be described, listed and tested without WordPress in the loop. For
 * now the course is a single article page; further pages are added here.
 */
class CourseCatalog {

	/**
	 * The bundled course pages, as slug => title. The block markup for each is
	 * loaded from `<content_dir>/<slug>.html` on demand.
	 *
	 * @var array<string, string>
	 */
	private const PAGES = array(
		'article-1' => 'The Hidden Cost of a Browser Tab',
	);

	/**
	 * Stores where the page content files live and which template the pages use.
	 *
	 * @param string $content_dir Absolute path to the directory holding the `<slug>.html` markup files.
	 * @param string $template    Page template slug every course page requests ('' for the theme default).
	 */
	public function __construct(
		private string $content_dir,
		private string $template
	) {
	}

	/**
	 * Builds the course's page definitions, loading each page's block markup
	 * from its content file.
	 *
	 * @return CoursePage[] The course pages, in course order.
	 */
	public function pages(): array {
		$pages = array();

		foreach ( self::PAGES as $slug => $title ) {
			$pages[] = new CoursePage( $slug, $title, $this->load( $slug ), $this->template );
		}

		return $pages;
	}

	/**
	 * Reads the block markup bundled for a page.
	 *
	 * @param string $slug Slug of the page whose markup to load.
	 * @return string The page's block markup, or '' when its content file is missing.
	 */
	private function load( string $slug ): string {
		$file = trailingslashit( $this->content_dir ) . $slug . '.html';

		if ( ! is_readable( $file ) ) {
			return '';
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a bundled local content file, not a remote URL.
		$markup = file_get_contents( $file );

		return false === $markup ? '' : $markup;
	}
}
