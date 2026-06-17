<?php
/**
 * Cockpit block manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\PageSeeder;

use function add_action;
use function add_filter;
use function register_block_type;
use function sprintf;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the cockpit block and the page it lives on. The cockpit is a
 * server-rendered block driven by the Interactivity API: its viewport is an
 * iframe whose source is decided client-side from the course page list, and
 * the configuration controls (run mode, duration, …) will extend the same
 * Interactivity store as the cockpit grows.
 *
 * Two pieces of wiring make the page list reach the block. First, the cockpit
 * opts its `pages` attribute into the Block Bindings API — custom block
 * attributes are not bindable by default — via the per-block-type
 * `block_bindings_supported_attributes_{$name}` filter. Second, it seeds the
 * page the cockpit is placed on, whose only content is the cockpit block with
 * its `pages` attribute bound to the {@see CoursePagesSource}. WordPress then
 * resolves the binding at render time and hands the list to the block.
 */
class Cockpit implements Manager {

	/**
	 * Stores everything needed to register the block and seed its host page.
	 *
	 * @param string     $block_dir   Absolute path to the built block directory holding its `block.json`.
	 * @param string     $block_name  The block's registered name (e.g. `bsb/cockpit`).
	 * @param string     $source_name Bindings source name the `pages` attribute binds to.
	 * @param string     $page_title  Title of the page the cockpit is placed on.
	 * @param PageSeeder $seeder      Creates and maintains the cockpit's host page.
	 */
	public function __construct(
		private string $block_dir,
		private string $block_name,
		private string $source_name,
		private string $page_title,
		private PageSeeder $seeder
	) {
	}

	/**
	 * Hooks block registration and page seeding onto `init`, and opts the
	 * cockpit's `pages` attribute into the Block Bindings API.
	 *
	 * @return void
	 */
	public function register(): void {
		add_filter(
			'block_bindings_supported_attributes_' . $this->block_name,
			array( $this, 'allow_pages_binding' )
		);
		add_action( 'init', array( $this, 'register_block' ) );
		add_action( 'init', array( $this, 'seed_page' ) );
	}

	/**
	 * Registers the cockpit block from its built `block.json`, which wires in
	 * the server render template and the Interactivity API view module.
	 *
	 * @return void
	 */
	public function register_block(): void {
		register_block_type( $this->block_dir );
	}

	/**
	 * Ensures the page the cockpit is placed on exists. Its content is the
	 * cockpit block alone, with the `pages` attribute bound to the course-pages
	 * source so the list is supplied server-side at render time.
	 *
	 * @return void
	 */
	public function seed_page(): void {
		$this->seeder->ensure( 'cockpit', $this->page_title, $this->host_markup(), '' );
	}

	/**
	 * Adds the cockpit's `pages` attribute to the list of attributes the Block
	 * Bindings API may resolve for this block. Without this, WordPress only
	 * binds a fixed set of core block attributes and would ignore the binding.
	 *
	 * @param array<int, string> $attributes Attributes already bindable for the block.
	 * @return array<int, string> The attributes with `pages` added.
	 */
	public function allow_pages_binding( array $attributes ): array {
		$attributes[] = 'pages';

		return $attributes;
	}

	/**
	 * Builds the host page's block markup: the cockpit block with its `pages`
	 * attribute bound to the course-pages source.
	 *
	 * @return string The serialized block markup.
	 */
	private function host_markup(): string {
		return sprintf(
			'<!-- wp:%s {"metadata":{"bindings":{"pages":{"source":"%s"}}}} /-->',
			$this->block_name,
			$this->source_name
		);
	}
}
