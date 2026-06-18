<?php
/**
 * Course catalog.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use function is_readable;
use function trailingslashit;
use function WP_Filesystem;

defined( 'ABSPATH' ) || exit;

/**
 * The single source of truth for which pages make up the surf course and what
 * each one contains. It pairs a static list of page definitions with the block
 * markup each one ships, loaded from the plugin's bundled content files.
 *
 * The catalog is deliberately storage-agnostic: it produces {@see CoursePage}
 * value objects and never touches the database or the request. The course is
 * never seeded as real pages — the {@see CourseRouter} injects a page's markup
 * at request time. Markup is read from the bundled content files through the
 * WordPress filesystem abstraction. For now the course is a single article;
 * further pages are added here.
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
		'gallery'   => 'Inside the Machine',
		'article-2' => 'What Drains a Laptop Battery, Ranked',
		'video'     => "Watch: Inside a Modern Laptop's Power Path",
		'links'     => 'News Hub: Energy & Computing',
		'blank'     => 'Baseline Calibration',
	);

	/**
	 * Stores where the page content files live.
	 *
	 * @param string $content_dir Absolute path to the directory holding the `<slug>.html` markup files.
	 */
	public function __construct( private string $content_dir ) {
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
			$pages[] = new CoursePage( $slug, $title, $this->load( $slug ) );
		}

		return $pages;
	}

	/**
	 * Finds a single course page by slug.
	 *
	 * @param string $slug Slug of the page to find.
	 * @return CoursePage|null The matching page, or null when the slug is not in the course.
	 */
	public function find( string $slug ): ?CoursePage {
		if ( ! isset( self::PAGES[ $slug ] ) ) {
			return null;
		}

		return new CoursePage( $slug, self::PAGES[ $slug ], $this->load( $slug ) );
	}

	/**
	 * Reads the block markup bundled for a page through the WordPress filesystem
	 * abstraction.
	 *
	 * @param string $slug Slug of the page whose markup to load.
	 * @return string The page's block markup, or '' when its content file is missing or unreadable.
	 */
	private function load( string $slug ): string {
		$file = trailingslashit( $this->content_dir ) . $slug . '.html';

		if ( ! is_readable( $file ) ) {
			return '';
		}

		$filesystem = $this->filesystem();

		if ( null === $filesystem ) {
			return '';
		}

		$markup = $filesystem->get_contents( $file );

		return false === $markup ? '' : (string) $markup;
	}

	/**
	 * Resolves the initialized WordPress filesystem, bootstrapping it on first
	 * use. Returns null when the filesystem cannot be initialized (e.g. a host
	 * that demands FTP credentials), so a read degrades to empty content rather
	 * than a fatal error.
	 *
	 * @return \WP_Filesystem_Base|null The filesystem, or null when unavailable.
	 */
	private function filesystem(): ?\WP_Filesystem_Base {
		global $wp_filesystem;

		if ( $wp_filesystem instanceof \WP_Filesystem_Base ) {
			return $wp_filesystem;
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';

		return WP_Filesystem() ? $wp_filesystem : null;
	}
}
