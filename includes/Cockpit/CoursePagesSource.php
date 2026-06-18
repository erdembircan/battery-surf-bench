<?php
/**
 * Course-pages Block Bindings source.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use ErdemBircan\BatterySurfBench\Course\CourseLibrary;
use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function register_block_bindings_source;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the Block Bindings source that feeds the cockpit its list of
 * surfable course pages. The cockpit block binds its `pages` attribute to this
 * source, so the page list is delivered through WordPress's own server-side
 * bindings mechanism — resolved at render time, with no client request — rather
 * than localized onto a script by hand.
 *
 * The source is a thin adapter: it owns no data of its own and defers entirely
 * to the {@see CourseLibrary} for the live slug/title/URL of each page. That
 * keeps the course domain the single authority on what the course is, while
 * this class owns only the binding plumbing that exposes it to blocks.
 */
class CoursePagesSource implements Manager {

	/**
	 * Stores the binding source name and the course library it reads from.
	 *
	 * @param string        $source_name Bindings source name (e.g. `bsb/course-pages`).
	 * @param CourseLibrary $library     Source of the course pages the binding exposes.
	 */
	public function __construct(
		private string $source_name,
		private CourseLibrary $library
	) {
	}

	/**
	 * Hooks source registration onto `init`, where the Block Bindings registry
	 * is available.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_source' ) );
	}

	/**
	 * Registers the binding source with WordPress.
	 *
	 * @return void
	 */
	public function register_source(): void {
		register_block_bindings_source(
			$this->source_name,
			array(
				'label'              => __( 'Course pages', 'battery-surf-bench' ),
				'get_value_callback' => array( $this, 'value' ),
			)
		);
	}

	/**
	 * Resolves a bound attribute to the list of course pages the cockpit surfs.
	 * WordPress calls this when rendering a block whose attribute binds to this
	 * source; the cockpit's `pages` attribute receives the whole list.
	 *
	 * @param array<string, mixed> $source_args    Arguments declared on the binding (unused; the source has one value).
	 * @param mixed                $block_instance The block being rendered.
	 * @param string               $attribute_name Name of the bound attribute.
	 * @return array<int, array{slug: string, title: string, url: string}> The course pages.
	 */
	public function value( array $source_args, mixed $block_instance, string $attribute_name ): array {
		return $this->library->links();
	}
}
