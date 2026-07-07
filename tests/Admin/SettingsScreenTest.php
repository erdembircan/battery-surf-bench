<?php
/**
 * Tests for the settings screen manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Admin\SettingsScreen;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the settings screen: where it places itself, that it
 * loads its bundle only on its own page, that it registers the surf-course
 * order option, and what it renders.
 */
final class SettingsScreenTest extends TestCase {

	private const SLUG        = 'battery-surf-bench';
	private const CAPABILITY  = 'manage_options';
	private const ICON_URL    = 'https://example.test/assets/images/menu-icon.svg';
	private const ICON_STYLE  = 'build/style-admin-menu.css';
	private const BUNDLE      = 'build/settings.js';
	private const STYLE       = 'build/style-settings.css';
	private const OPTION_NAME = 'bsb_course_order';
	private const HOOK        = 'toplevel_page_battery-surf-bench';

	/**
	 * Builds a screen with representative configuration.
	 *
	 * @param Assets|null $assets Asset service to inject, mocked when omitted.
	 * @return SettingsScreen The screen under test.
	 */
	private function screen( ?Assets $assets = null ): SettingsScreen {
		$catalog = new CourseCatalog( __DIR__ );

		return new SettingsScreen(
			self::SLUG,
			self::CAPABILITY,
			self::ICON_URL,
			self::ICON_STYLE,
			self::BUNDLE,
			self::STYLE,
			self::OPTION_NAME,
			array( 'page', 'post' ),
			new CourseOrderSanitizer( $catalog, array( 'page', 'post' ) ),
			$catalog,
			$assets ?? Mockery::mock( Assets::class ),
			'bsbSession',
			'cockpit'
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->screen() );
	}

	/**
	 * Registering the screen hooks its page, its icon style, its bundle and the
	 * surf-course order option into the WordPress lifecycle.
	 */
	public function test_register_hooks_page_assets_and_option(): void {
		$screen = $this->screen();
		$screen->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $screen, 'add_page' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $screen, 'enqueue_icon_style' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $screen, 'enqueue' ) ) );
		$this->assertNotFalse( has_action( 'init', array( $screen, 'register_option' ) ) );
	}

	/**
	 * The page is added with the injected slug, capability and icon — the
	 * arguments WordPress uses to place and gate the top-level menu.
	 */
	public function test_add_page_registers_top_level_menu_with_injected_config(): void {
		$screen = $this->screen();

		Functions\expect( 'add_menu_page' )
			->once()
			->with(
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				self::CAPABILITY,
				self::SLUG,
				array( $screen, 'render' ),
				self::ICON_URL
			)
			->andReturn( self::HOOK );

		$screen->add_page();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Enqueuing the icon style hands the menu's stylesheet to the asset service.
	 */
	public function test_enqueue_icon_style_delegates_to_the_asset_service(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'enqueue' )->once()->with( self::ICON_STYLE );

		$this->screen( $assets )->enqueue_icon_style();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The heavy settings bundle must never load on any screen but its own.
	 */
	public function test_enqueue_skips_other_screens(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )->never();

		$this->screen( $assets )->enqueue( 'some-other-admin-page' );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * On its own screen the settings app drives the asset service end to end —
	 * registering the bundle, localizing the screen configuration onto it,
	 * registering its translations, enqueuing it, and enqueuing its stylesheet
	 * (which declares `wp-components` as a dependency).
	 */
	public function test_enqueue_loads_the_settings_app_on_its_own_screen(): void {
		Functions\when( 'get_option' )->justReturn( array() );

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )
			->once()
			->with( self::BUNDLE )
			->andReturn( 'bsb-settings' );
		$assets->shouldReceive( 'localize' )
			->once()
			->with(
				'bsb-settings',
				'bsbSettings',
				Mockery::on(
					static function ( $config ): bool {
						return array( 'page', 'post' ) === $config['postTypes']
							&& self::OPTION_NAME === $config['optionKey']
							&& is_array( $config['courseOrder'] )
							&& is_array( $config['bundledCatalog'] )
							&& count( $config['bundledCatalog'] ) > 0
							&& isset( $config['bundledCatalog'][0]['slug'], $config['bundledCatalog'][0]['title'] );
					}
				)
			);
		$assets->shouldReceive( 'set_script_translations' )
			->once()
			->with( 'bsb-settings' );
		$assets->shouldReceive( 'enqueue_script' )
			->once()
			->with( 'bsb-settings' );
		$assets->shouldReceive( 'enqueue' )
			->once()
			->with( self::STYLE, array( 'wp-components' ) );

		Functions\when( 'add_menu_page' )->justReturn( self::HOOK );

		$screen = $this->screen( $assets );
		$screen->add_page();
		$screen->enqueue( self::HOOK );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Registering the option hands WordPress a schema wide enough to express
	 * the ordered, heterogeneous entries, plus the sanitizer's default and
	 * sanitize callback — so a stale or malformed saved order self-heals.
	 */
	public function test_register_option_registers_a_healing_setting(): void {
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

		$this->screen()->register_option();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The screen renders the brand header (title and subtitle), the cockpit
	 * link, the save slot the app portals its button into, and the mount point.
	 */
	public function test_render_outputs_brand_header_cockpit_link_save_slot_and_mount_point(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.test/' );
		Functions\when( 'add_query_arg' )->alias(
			static fn ( string $key, string $value, string $url ): string => $url . '?' . $key . '=' . $value
		);
		Functions\when( 'esc_url' )->returnArg();

		ob_start();
		$this->screen()->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( '<div class="bsb-settings">', $output );
		$this->assertStringContainsString( 'Battery Surf Bench', $output );
		$this->assertStringContainsString( 'Settings', $output );
		$this->assertStringContainsString( 'bsb-settings__save-slot', $output );
		$this->assertStringContainsString( 'id="bsb-settings-app"', $output );
		$this->assertStringContainsString( 'https://example.test/?bsbSession=cockpit', $output );
		$this->assertStringContainsString( 'New Benchmark', $output );
	}
}
