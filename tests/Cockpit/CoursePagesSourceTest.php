<?php
/**
 * Tests for the course-pages Block Bindings source.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Cockpit;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Cockpit\CoursePagesSource;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseLibrary;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * The source is the bridge that hands the course page list to the cockpit
 * through WordPress's Block Bindings mechanism. Its contract: register itself
 * under the configured name and resolve a bound attribute to the library's
 * page list.
 */
final class CoursePagesSourceTest extends TestCase {

	private const SOURCE = 'bsb/course-pages';

	/**
	 * The page list a stubbed library reports. Public so the anonymous stub
	 * library (a separate class) can return it.
	 *
	 * @var array<int, array{slug: string, title: string, url: string}>
	 */
	public const LINKS = array(
		array(
			'slug'  => 'article-1',
			'title' => 'The Hidden Cost of a Browser Tab',
			'url'   => 'https://example.test/article-1',
		),
	);

	/**
	 * Builds a source backed by a library stubbed to report {@see self::LINKS}.
	 *
	 * @return CoursePagesSource The source under test.
	 */
	private function source(): CoursePagesSource {
		$catalog = new CourseCatalog( '/plugin/includes/Course/content' );
		$library = new class( $catalog, 'bsbSessionPage', 'bsb_course_order', new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) ) ) extends CourseLibrary {

			/**
			 * Reports a fixed page list in place of seeded pages.
			 *
			 * @return array<int, array{slug: string, title: string, url: string}> The stubbed list.
			 */
			public function links(): array {
				return CoursePagesSourceTest::LINKS;
			}
		};

		return new CoursePagesSource( self::SOURCE, $library );
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->source() );
	}

	/**
	 * Source registration is deferred to `init`, where the bindings registry
	 * is available.
	 */
	public function test_register_hooks_registration_onto_init(): void {
		$source = $this->source();
		$source->register();

		$this->assertNotFalse( has_action( 'init', array( $source, 'register_source' ) ) );
	}

	/**
	 * The source registers under its configured name with a callable resolver,
	 * the contract the cockpit's bound `pages` attribute relies on.
	 */
	public function test_registers_a_named_source_with_a_resolver(): void {
		Functions\expect( 'register_block_bindings_source' )
			->once()
			->with(
				self::SOURCE,
				Mockery::on(
					static fn ( array $args ): bool => is_callable( $args['get_value_callback'] )
				)
			);

		$this->source()->register_source();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * Resolving a bound attribute yields the library's page list — the data the
	 * cockpit surfs.
	 */
	public function test_value_returns_the_course_page_list(): void {
		$this->assertSame( self::LINKS, $this->source()->value( array(), null, 'pages' ) );
	}
}
