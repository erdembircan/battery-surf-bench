<?php
/**
 * Course page definition.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

defined( 'ABSPATH' ) || exit;

/**
 * One synthetic course page the benchmark surfs: an immutable definition of its
 * stable slug, its title, the block markup it renders as, and the page template
 * it should be shown with. It is a value object only — it knows nothing about
 * WordPress or how it is stored, so the {@see CourseCatalog} can describe the
 * course independently of the {@see CourseLibrary} that seeds it.
 */
class CoursePage {

	/**
	 * Stores the page's definition.
	 *
	 * @param string $slug     Stable identifier for the page within the course.
	 * @param string $title    Human-readable title; becomes the WordPress page title.
	 * @param string $content  Serialized block markup for the page body.
	 * @param string $template Page template slug to request ('' for the theme default).
	 */
	public function __construct(
		private string $slug,
		private string $title,
		private string $content,
		private string $template
	) {
	}

	/**
	 * The page's stable slug.
	 *
	 * @return string The slug.
	 */
	public function slug(): string {
		return $this->slug;
	}

	/**
	 * The page's title.
	 *
	 * @return string The title.
	 */
	public function title(): string {
		return $this->title;
	}

	/**
	 * The page's serialized block markup.
	 *
	 * @return string The block markup.
	 */
	public function content(): string {
		return $this->content;
	}

	/**
	 * The page template the page requests.
	 *
	 * @return string The template slug, or '' for the theme's default.
	 */
	public function template(): string {
		return $this->template;
	}
}
