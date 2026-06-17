<?php
/**
 * Tests for the cockpit block manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Cockpit\Cockpit;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\PageSeeder;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

use function has_action;
use function has_filter;

/**
 * The cockpit manager wires up the block and the page it lives on. Its
 * observable contract: register the block from its built directory, opt the
 * `pages` attribute into Block Bindings, and seed a host page whose content is
 * the cockpit block with `pages` bound to the course-pages source.
 */
final class CockpitTest extends TestCase {

	private const BLOCK_DIR  = '/plugin/build/cockpit';
	private const BLOCK_NAME = 'bsb/cockpit';
	private const SOURCE     = 'bsb/course-pages';
	private const PAGE_TITLE = 'Battery Surf Bench';

	/**
	 * Builds a cockpit manager backed by the given seeder.
	 *
	 * @param PageSeeder $seeder Seeder the cockpit seeds its host page through.
	 * @return Cockpit The manager under test.
	 */
	private function cockpit( PageSeeder $seeder ): Cockpit {
		return new Cockpit( self::BLOCK_DIR, self::BLOCK_NAME, self::SOURCE, self::PAGE_TITLE, $seeder );
	}

	/**
	 * A recording seeder capturing the host page it is asked to ensure.
	 *
	 * @return PageSeeder The recording seeder.
	 */
	private function recording_seeder(): PageSeeder {
		return new class( '_m' ) extends PageSeeder {

			/**
			 * Captured `ensure()` calls.
			 *
			 * @var array<int, array<string, mixed>>
			 */
			public array $ensured = array();

			/**
			 * Records the call instead of persisting a page.
			 *
			 * @param string      $marker   Page marker.
			 * @param string      $title    Page title.
			 * @param string      $content  Page block markup.
			 * @param string|null $template Requested template.
			 * @return int A stand-in post ID.
			 */
			public function ensure( string $marker, string $title, string $content, ?string $template = null ): int {
				$this->ensured[] = compact( 'marker', 'title', 'content', 'template' );

				return 1;
			}
		};
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->cockpit( $this->recording_seeder() ) );
	}

	/**
	 * Registration opts `pages` into Block Bindings via the per-block filter and
	 * defers block registration and page seeding to `init`.
	 */
	public function test_register_wires_binding_filter_and_init_hooks(): void {
		$cockpit = $this->cockpit( $this->recording_seeder() );
		$cockpit->register();

		$this->assertNotFalse(
			has_filter( 'block_bindings_supported_attributes_' . self::BLOCK_NAME, array( $cockpit, 'allow_pages_binding' ) )
		);
		$this->assertNotFalse( has_action( 'init', array( $cockpit, 'register_block' ) ) );
		$this->assertNotFalse( has_action( 'init', array( $cockpit, 'seed_page' ) ) );
	}

	/**
	 * The cockpit adds `pages` to the attributes WordPress may bind for the
	 * block; without it, the bound page list would be ignored.
	 */
	public function test_allow_pages_binding_adds_the_pages_attribute(): void {
		$cockpit = $this->cockpit( $this->recording_seeder() );

		$this->assertSame( array( 'content', 'pages' ), $cockpit->allow_pages_binding( array( 'content' ) ) );
	}

	/**
	 * The block is registered from its built directory, where its block.json,
	 * render template and view module live.
	 */
	public function test_register_block_registers_from_the_built_directory(): void {
		Functions\expect( 'register_block_type' )->once()->with( self::BLOCK_DIR );

		$this->cockpit( $this->recording_seeder() )->register_block();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * The host page is seeded with the theme default template and its content is
	 * the cockpit block alone, with `pages` bound to the course-pages source.
	 */
	public function test_seed_page_seeds_the_bound_cockpit_block(): void {
		$seeder = $this->recording_seeder();
		$this->cockpit( $seeder )->seed_page();

		$this->assertCount( 1, $seeder->ensured );
		$seeded = $seeder->ensured[0];
		$this->assertSame( 'cockpit', $seeded['marker'] );
		$this->assertSame( self::PAGE_TITLE, $seeded['title'] );
		$this->assertSame( '', $seeded['template'] );
		$this->assertStringContainsString( 'wp:' . self::BLOCK_NAME, $seeded['content'] );
		$this->assertStringContainsString( '"pages":{"source":"' . self::SOURCE . '"}', $seeded['content'] );
	}
}
