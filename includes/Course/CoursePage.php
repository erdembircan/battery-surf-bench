<?php
/**
 * Course page definition.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

defined( 'ABSPATH' ) || exit;

/**
 * One synthetic course page the benchmark surfs: an immutable pairing of a
 * stable slug, a title, and the block markup the page renders as. It is a value
 * object only — it knows nothing about WordPress, the request, or how it is
 * served, so the {@see CourseCatalog} can describe the course independently of
 * the router that renders it.
 */
class CoursePage {

	/**
	 * Stores the page's definition.
	 *
	 * @param string $slug    Stable identifier for the page within the course.
	 * @param string $title   Human-readable title.
	 * @param string $content Serialized block markup for the page body.
	 */
	public function __construct(
		private string $slug,
		private string $title,
		private string $content
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
}
