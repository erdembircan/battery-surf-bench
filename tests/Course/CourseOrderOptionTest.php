<?php
/**
 * Tests for the surf-course order option definition.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderOption;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Settings\OptionProvider;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

/**
 * Behavioral tests for the surf-course order option's definition: that it
 * names the right option and carries a healing schema wide enough for the
 * ordered, heterogeneous entries. Registering the definition with WordPress
 * is {@see \ErdemBircan\BatterySurfBench\Settings\OptionRegistry}'s job, not
 * this class's — covered by
 * {@see \ErdemBircan\BatterySurfBench\Tests\Settings\OptionRegistryTest}.
 */
final class CourseOrderOptionTest extends TestCase {

	private const OPTION_NAME = 'bsb_course_order';

	/**
	 * Builds an option definition provider over the real catalog restricted
	 * to pages and posts as selectable user types.
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
	 * OptionRegistry relies on every provider it holds honouring this
	 * contract.
	 */
	public function test_is_an_option_provider(): void {
		$this->assertInstanceOf( OptionProvider::class, $this->option() );
	}

	/**
	 * The definition names the option it describes.
	 */
	public function test_definition_names_the_option(): void {
		$definition = $this->option()->definition();

		$this->assertSame( self::OPTION_NAME, $definition['name'] );
	}

	/**
	 * The definition's args carry a schema wide enough to express the
	 * ordered, heterogeneous entries, plus the sanitizer's default and
	 * sanitize callback — so a stale or malformed saved order self-heals.
	 */
	public function test_definition_args_describe_a_healing_setting(): void {
		$args = $this->option()->definition()['args'];

		$this->assertSame( 'array', $args['type'] );
		$this->assertIsArray( $args['show_in_rest']['schema'] );
		$this->assertIsCallable( $args['sanitize_callback'] );
	}

	/**
	 * The registered default is the sanitizer's own default order — the
	 * bundled catalog, before any user page has been added.
	 */
	public function test_definition_default_is_the_sanitizers_default_order(): void {
		$catalog   = new CourseCatalog( __DIR__ );
		$sanitizer = new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) );
		$option    = new CourseOrderOption( self::OPTION_NAME, $sanitizer );

		$this->assertSame(
			$sanitizer->default_order(),
			$option->definition()['args']['default']
		);
	}

	/**
	 * The sanitize callback wired into the definition is the injected
	 * sanitizer's own `sanitize()` method — the option is validated and
	 * healed through the exact same collaborator the settings screen uses to
	 * heal it again on every read.
	 */
	public function test_definition_sanitize_callback_is_the_injected_sanitizers_sanitize_method(): void {
		$catalog   = new CourseCatalog( __DIR__ );
		$sanitizer = new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) );
		$option    = new CourseOrderOption( self::OPTION_NAME, $sanitizer );

		$this->assertSame(
			array( $sanitizer, 'sanitize' ),
			$option->definition()['args']['sanitize_callback']
		);
	}
}
