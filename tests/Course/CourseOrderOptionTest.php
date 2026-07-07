<?php
/**
 * Tests for the surf-course order option registration.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderOption;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the surf-course order option: that it hooks its own
 * registration onto `init`, and that the option it registers carries a
 * healing schema wide enough for the ordered, heterogeneous entries.
 */
final class CourseOrderOptionTest extends TestCase {

	private const OPTION_NAME = 'bsb_course_order';

	/**
	 * Builds an option registration over the real catalog restricted to pages
	 * and posts as selectable user types.
	 *
	 * @return CourseOrderOption The option under test.
	 */
	private function option(): CourseOrderOption {
		$catalog = new CourseCatalog( __DIR__ );

		return new CourseOrderOption(
			self::OPTION_NAME,
			new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) )
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->option() );
	}

	/**
	 * Registering hooks the option's own registration onto `init`, so it is
	 * registered before any screen that reads or writes it renders.
	 */
	public function test_register_hooks_the_setting_registration_onto_init(): void {
		$option = $this->option();
		$option->register();

		$this->assertNotFalse( has_action( 'init', array( $option, 'register_setting_callback' ) ) );
	}

	/**
	 * The registered setting carries a schema wide enough to express the
	 * ordered, heterogeneous entries, plus the sanitizer's default and
	 * sanitize callback — so a stale or malformed saved order self-heals.
	 */
	public function test_register_setting_callback_registers_a_healing_setting(): void {
		Functions\expect( 'register_setting' )
			->once()
			->with(
				Mockery::type( 'string' ),
				self::OPTION_NAME,
				Mockery::on(
					static function ( array $args ): bool {
						return 'array' === $args['type']
							&& is_array( $args['default'] )
							&& is_array( $args['show_in_rest']['schema'] )
							&& is_callable( $args['sanitize_callback'] );
					}
				)
			);

		$this->option()->register_setting_callback();

		$this->addToAssertionCount( 1 );
	}
}
