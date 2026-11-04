<?php
/**
 * Course catalog.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use function function_exists;
use function request_filesystem_credentials;
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
		'video'     => 'Watch: Nineteen Seconds That Started It All',
		'links'     => 'News Hub: Energy & Computing',
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
		$file       = trailingslashit( $this->content_dir ) . $slug . '.html';
		$filesystem = $this->filesystem();

		if ( null === $filesystem || ! $filesystem->exists( $file ) ) {
			return '';
		}

		$markup = $filesystem->get_contents( $file );

		return false === $markup ? '' : (string) $markup;
	}

	/**
	 * Resolves the initialized WordPress filesystem, bootstrapping it on first
	 * use. Credentials for the content directory are requested first — on the
	 * usual `direct` method none are needed, but a host that requires FTP/SSH
	 * credentials returns false (we cannot prompt for them mid-request), in which
	 * case this returns null so a read degrades to empty content rather than a
	 * fatal error.
	 *
	 * @return \WP_Filesystem_Base|null The filesystem, or null when it cannot be initialized.
	 */
	private function filesystem(): ?\WP_Filesystem_Base {
		global $wp_filesystem;

		if ( $wp_filesystem instanceof \WP_Filesystem_Base ) {
			return $wp_filesystem;
		}

		if ( ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		$credentials = request_filesystem_credentials( '', '', false, $this->content_dir, null, true );

		if ( false === $credentials ) {
			return null;
		}

		if ( ! WP_Filesystem( $credentials ) ) {
			return null;
		}

		return $wp_filesystem;
	}
}
