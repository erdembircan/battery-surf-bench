<?php
/**
 * Tests for the benchmark sessions listing screen.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Admin\SessionsScreen;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the listing screen: where it places itself, that it
 * loads its bundle only on its own page, and what it renders.
 */
final class SessionsScreenTest extends TestCase {

	private const PARENT     = 'battery-surf-bench';
	private const PAGE_SLUG  = 'bsb-sessions';
	private const CAPABILITY = 'manage_options';
	private const BUNDLE     = 'build/sessions.js';
	private const STYLE      = 'build/style-sessions.css';
	private const HOOK       = 'battery-surf-bench_page_bsb-sessions';

	/**
	 * Builds a screen with representative configuration.
	 *
	 * @param Assets|null $assets Asset service to inject, mocked when omitted.
	 * @return SessionsScreen The screen under test.
	 */
	private function screen( ?Assets $assets = null ): SessionsScreen {
		return new SessionsScreen(
			self::PARENT,
			self::PAGE_SLUG,
			self::CAPABILITY,
			self::BUNDLE,
			self::STYLE,
			new SessionSchema( 'bsb_session', 'bsb_' ),
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
	 * Registering the screen hooks its page onto the menu and its assets onto
	 * admin asset loading.
	 */
	public function test_register_hooks_page_and_assets(): void {
		$screen = $this->screen();
		$screen->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $screen, 'add_page' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $screen, 'enqueue' ) ) );
	}

	/**
	 * The listing is placed under the plugin menu, gated by the plugin
	 * capability, and rendered by the screen.
	 */
	public function test_add_page_registers_submenu_under_the_plugin_menu(): void {
		$screen = $this->screen();

		Functions\expect( 'add_submenu_page' )
			->once()
			->with(
				self::PARENT,
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				self::CAPABILITY,
				self::PAGE_SLUG,
				Mockery::on(
					static fn( $callback ) => is_array( $callback ) && 'render' === $callback[1]
				)
			)
			->andReturn( self::HOOK );

		$screen->add_page();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The bundle is heavy, so it must never load on any screen but its own.
	 */
	public function test_enqueue_skips_other_screens(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )->never();

		$this->screen( $assets )->enqueue( 'some-other-admin-page' );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * On its own screen the listing drives the asset service end to end —
	 * registering the bundle, localizing the schema onto it, registering its
	 * translations so its strings localize, enqueuing it, and enqueuing its
	 * stylesheet (which declares `wp-components` as a dependency). The screen
	 * itself never calls WordPress' enqueue functions.
	 */
	public function test_enqueue_loads_the_listing_on_its_own_screen(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )
			->once()
			->with( self::BUNDLE )
			->andReturn( 'bsb-sessions' );
		$assets->shouldReceive( 'localize' )
			->once()
			->with( 'bsb-sessions', 'bsbSessions', Mockery::type( 'array' ) );
		$assets->shouldReceive( 'set_script_translations' )
			->once()
			->with( 'bsb-sessions' );
		$assets->shouldReceive( 'enqueue_script' )
			->once()
			->with( 'bsb-sessions' );
		$assets->shouldReceive( 'enqueue' )
			->once()
			->with( self::STYLE, array( 'wp-components' ) );

		Functions\when( 'add_submenu_page' )->justReturn( self::HOOK );

		$screen = $this->screen( $assets );
		$screen->add_page();
		$screen->enqueue( self::HOOK );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The screen renders the brand header (title and subtitle), a cockpit link,
	 * and the container the bundle mounts into.
	 */
	public function test_render_outputs_brand_header_cockpit_link_and_mount_point(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.test/' );
		Functions\when( 'add_query_arg' )->alias(
			static fn ( string $key, string $value, string $url ): string => $url . '?' . $key . '=' . $value
		);
		Functions\when( 'esc_url' )->returnArg();

		ob_start();
		$this->screen()->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( '<div class="bsb-sessions">', $output );
		$this->assertStringContainsString( 'Sessions', $output );
		$this->assertStringContainsString( 'Benchmark log', $output );
		// The grid bundle fills this slot with the live session total.
		$this->assertStringContainsString( 'bsb-sessions__count', $output );
		$this->assertStringContainsString( 'id="bsb-sessions-app"', $output );
		$this->assertStringContainsString( 'https://example.test/?bsbSession=cockpit', $output );
		$this->assertStringContainsString( 'New Benchmark', $output );
	}
}
