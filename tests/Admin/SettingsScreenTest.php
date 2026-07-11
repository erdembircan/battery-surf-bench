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
use ErdemBircan\BatterySurfBench\Tests\Support\FakeCapability;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use WP_REST_Request;

use function has_action;
use function in_array;

/**
 * Behavioral tests for the settings screen: where it places itself, that it
 * loads its bundle only on its own page, that it heals a stale saved order
 * through the sanitizer on every read (not only on save), and what it renders.
 * The surf-course order option's own registration is covered by
 * {@see \ErdemBircan\BatterySurfBench\Tests\Settings\OptionRegistryTest}; its
 * definition (the schema and defaults `screen_config()` relies on) is covered
 * by {@see \ErdemBircan\BatterySurfBench\Tests\Course\CourseOrderOptionTest}.
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
	 * Builds a screen with representative configuration, backed by a real
	 * sanitizer over the real catalog so `screen_config()`'s heal-on-read
	 * behaviour can be exercised end to end.
	 *
	 * @param Assets|null $assets Asset service to inject, mocked when omitted.
	 * @return SettingsScreen The screen under test.
	 */
	private function screen( ?Assets $assets = null ): SettingsScreen {
		$catalog = new CourseCatalog( __DIR__ );

		return new SettingsScreen(
			self::SLUG,
			new FakeCapability( true, self::CAPABILITY ),
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
	 * Registering the screen hooks its page, its icon style and its bundle
	 * into the WordPress lifecycle.
	 */
	public function test_register_hooks_page_and_assets(): void {
		$screen = $this->screen();
		$screen->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $screen, 'add_page' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $screen, 'enqueue_icon_style' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $screen, 'enqueue' ) ) );
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
	 * Stubs the internal `/wp/v2/search` dispatch the seeded Browse query
	 * runs, so `enqueue()` can run end to end without a real REST server.
	 *
	 * Returns a `stdClass` box rather than an array: `rest_do_request()` is
	 * only actually called once `enqueue()` runs, after this method has
	 * already returned, so the caller needs a handle to the SAME mutable
	 * object the stubbed callback later writes `request` onto — an array
	 * returned by value would hand the caller an unrelated copy.
	 *
	 * @param array<int, array<string, mixed>> $records Records the stubbed dispatch resolves to.
	 * @param array<string, string>            $headers Response headers the stubbed dispatch resolves to.
	 * @return \stdClass Box with a `request` property, populated once `rest_do_request()` is actually called.
	 */
	private function stub_initial_browse_dispatch( array $records = array(), array $headers = array() ): \stdClass {
		$captured          = new \stdClass();
		$captured->request = null;

		Functions\when( 'rest_do_request' )->alias(
			static function ( $request ) use ( $captured, $headers ) {
				$captured->request = $request;

				return Mockery::mock( array( 'get_headers' => $headers ) );
			}
		);
		Functions\when( 'rest_get_server' )->justReturn(
			Mockery::mock( array( 'response_to_data' => $records ) )
		);

		return $captured;
	}

	/**
	 * On its own screen the settings app drives the asset service end to end —
	 * registering the bundle, localizing the screen configuration onto it,
	 * registering its translations, enqueuing it, and enqueuing its stylesheet
	 * (which declares `wp-components` as a dependency).
	 */
	public function test_enqueue_loads_the_settings_app_on_its_own_screen(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		$this->stub_initial_browse_dispatch(
			array(
				array(
					'id'      => 1,
					'title'   => 'About',
					'url'     => '/about',
					'subtype' => 'page',
				),
			),
			array(
				'X-WP-Total'      => '3',
				'X-WP-TotalPages' => '1',
			)
		);

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
							&& isset( $config['bundledCatalog'][0]['slug'], $config['bundledCatalog'][0]['title'] )
							&& is_array( $config['initialBrowse']['records'] )
							&& 1 === count( $config['initialBrowse']['records'] )
							&& 3 === $config['initialBrowse']['totalItems']
							&& 1 === $config['initialBrowse']['totalPages'];
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
	 * The seeded Browse query mirrors the client's own first fetch exactly —
	 * same type/subtype/page/per_page/_fields — so the localized seed is
	 * byte-identical to what the client would have fetched itself.
	 */
	public function test_enqueue_seeds_the_initial_browse_query_with_the_clients_own_args(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		$captured = $this->stub_initial_browse_dispatch();

		Functions\when( 'add_menu_page' )->justReturn( self::HOOK );

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )->andReturn( 'bsb-settings' );
		$assets->shouldReceive( 'localize' );
		$assets->shouldReceive( 'set_script_translations' );
		$assets->shouldReceive( 'enqueue_script' );
		$assets->shouldReceive( 'enqueue' );

		$screen = $this->screen( $assets );
		$screen->add_page();
		$screen->enqueue( self::HOOK );

		$this->assertInstanceOf( WP_REST_Request::class, $captured->request );
		$this->assertSame(
			array(
				'type'     => 'post',
				'subtype'  => 'page,post',
				'page'     => 1,
				'per_page' => 10,
				'_fields'  => 'id,title,url,subtype',
			),
			$captured->request->get_query_params()
		);
	}

	/**
	 * `register_setting`'s sanitize callback only runs when the option is
	 * saved, so a saved order that predates a newly added bundled page would
	 * render unhealed until the next save if `screen_config()` read it raw.
	 * It doesn't: the saved value is run back through the sanitizer on every
	 * read, so a missing bundled page is re-inserted on the very next render.
	 */
	public function test_screen_config_heals_a_stale_saved_order_missing_a_bundled_page(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				array(
					'kind' => 'bundled',
					'slug' => 'article-1',
				),
				// 'gallery', 'article-2', 'video' and 'links' are missing from
				// this stale saved order — as if they were added to the
				// catalog after this order was last saved.
			)
		);
		$this->stub_initial_browse_dispatch();
		Functions\when( 'add_menu_page' )->justReturn( self::HOOK );

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )->andReturn( 'bsb-settings' );
		$assets->shouldReceive( 'localize' )
			->once()
			->with(
				'bsb-settings',
				'bsbSettings',
				Mockery::on(
					static function ( $config ): bool {
						$slugs = array_column( $config['courseOrder'], 'slug' );

						return 5 === count( $config['courseOrder'] )
							&& in_array( 'links', $slugs, true );
					}
				)
			);
		$assets->shouldReceive( 'set_script_translations' );
		$assets->shouldReceive( 'enqueue_script' );
		$assets->shouldReceive( 'enqueue' );

		$screen = $this->screen( $assets );
		$screen->add_page();
		$screen->enqueue( self::HOOK );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Each saved user entry that still resolves to an eligible post —
	 * published, publicly viewable, of a selectable type — is localized with
	 * its title and type, so the app can paint a title on first render instead
	 * of a raw post id.
	 */
	public function test_enqueue_localizes_resolved_titles_for_eligible_saved_user_pages(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				array(
					'kind' => 'user',
					'id'   => 42,
				),
			)
		);
		Functions\when( 'get_post_status' )->justReturn( 'publish' );
		Functions\when( 'get_post_type' )->justReturn( 'page' );
		Functions\when( 'is_post_publicly_viewable' )->justReturn( true );
		Functions\when( 'get_the_title' )->justReturn( 'About' );
		$this->stub_initial_browse_dispatch();
		Functions\when( 'add_menu_page' )->justReturn( self::HOOK );

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )->andReturn( 'bsb-settings' );
		$assets->shouldReceive( 'localize' )
			->once()
			->with(
				'bsb-settings',
				'bsbSettings',
				Mockery::on(
					static function ( $config ): bool {
						return isset( $config['userPages'][42] )
							&& 'About' === $config['userPages'][42]['title']
							&& 'page' === $config['userPages'][42]['type'];
					}
				)
			);
		$assets->shouldReceive( 'set_script_translations' );
		$assets->shouldReceive( 'enqueue_script' );
		$assets->shouldReceive( 'enqueue' );

		$screen = $this->screen( $assets );
		$screen->add_page();
		$screen->enqueue( self::HOOK );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * A saved user entry that no longer resolves to an eligible post (trashed,
	 * unpublished, wrong type, or not publicly viewable) is left out of the
	 * resolved title map entirely — the client treats it as unresolved rather
	 * than being handed a stale title.
	 */
	public function test_enqueue_excludes_ineligible_saved_user_pages_from_resolved_titles(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				array(
					'kind' => 'user',
					'id'   => 7,
				),
			)
		);
		Functions\when( 'get_post_status' )->justReturn( 'draft' );
		Functions\when( 'get_post_type' )->justReturn( 'page' );
		Functions\when( 'is_post_publicly_viewable' )->justReturn( true );
		$this->stub_initial_browse_dispatch();
		Functions\when( 'add_menu_page' )->justReturn( self::HOOK );

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )->andReturn( 'bsb-settings' );
		$assets->shouldReceive( 'localize' )
			->once()
			->with(
				'bsb-settings',
				'bsbSettings',
				Mockery::on(
					static function ( $config ): bool {
						return array() === $config['userPages'];
					}
				)
			);
		$assets->shouldReceive( 'set_script_translations' );
		$assets->shouldReceive( 'enqueue_script' );
		$assets->shouldReceive( 'enqueue' );

		$screen = $this->screen( $assets );
		$screen->add_page();
		$screen->enqueue( self::HOOK );

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
