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
			new SessionSchema( 'bsb_session', 'bsb_' ),
			$assets ?? Mockery::mock( Assets::class )
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
	 * On its own screen the listing registers its bundle, localizes the schema
	 * ahead of it, and brings in the DataViews and components styles — the
	 * editor packages WordPress provides.
	 */
	public function test_enqueue_loads_the_listing_on_its_own_screen(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )
			->once()
			->with( 'build/sessions.js' )
			->andReturn( 'bsb-sessions' );
		$assets->shouldReceive( 'enqueue' )
			->once()
			->with( 'build/style-sessions.css', array( 'wp-components' ) );

		Functions\when( 'add_submenu_page' )->justReturn( self::HOOK );
		Functions\when( 'wp_json_encode' )->alias( 'json_encode' );

		Functions\expect( 'wp_add_inline_script' )
			->once()
			->with( 'bsb-sessions', Mockery::type( 'string' ), 'before' );
		Functions\expect( 'wp_enqueue_script' )->once()->with( 'bsb-sessions' );
		Functions\expect( 'wp_enqueue_style' )->once()->with( 'wp-components' );
		Functions\expect( 'wp_enqueue_style' )->once()->with( 'wp-dataviews' );

		$screen = $this->screen( $assets );
		$screen->add_page();
		$screen->enqueue( self::HOOK );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The screen renders a heading and the container the bundle mounts into.
	 */
	public function test_render_outputs_heading_and_mount_point(): void {
		ob_start();
		$this->screen()->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( 'Benchmark Sessions', $output );
		$this->assertStringContainsString( 'id="bsb-sessions-app"', $output );
	}
}
