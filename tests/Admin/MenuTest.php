<?php
/**
 * Tests for the admin menu manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Admin\Menu;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the admin menu manager's public contract.
 */
final class MenuTest extends TestCase {

	private const SLUG       = 'battery-surf-bench';
	private const CAPABILITY = 'manage_options';
	private const ICON_URL   = 'https://example.test/assets/images/menu-icon.png';
	private const STYLE      = 'build/style-admin-menu.css';

	/**
	 * Builds a menu manager with representative injected configuration.
	 *
	 * @param Assets|null $assets Asset service to inject, mocked when omitted.
	 * @return Menu The manager under test.
	 */
	private function menu( ?Assets $assets = null ): Menu {
		return new Menu(
			self::SLUG,
			self::CAPABILITY,
			self::ICON_URL,
			self::STYLE,
			$assets ?? Mockery::mock( Assets::class )
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->menu() );
	}

	/**
	 * Registering the manager hooks its page onto the admin menu.
	 */
	public function test_register_hooks_page_onto_admin_menu(): void {
		$menu = $this->menu();
		$menu->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $menu, 'add_page' ) ) );
	}

	/**
	 * The page is added with the injected slug, capability and icon — the
	 * arguments WordPress uses to place and gate the menu.
	 */
	public function test_add_page_registers_top_level_menu_with_injected_config(): void {
		$menu = $this->menu();

		Functions\expect( 'add_menu_page' )
			->once()
			->with(
				Mockery::type( 'string' ),
				Mockery::type( 'string' ),
				self::CAPABILITY,
				self::SLUG,
				array( $menu, 'render' ),
				self::ICON_URL
			);

		$menu->add_page();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * Registering the manager hooks its icon styling onto admin asset loading.
	 */
	public function test_register_hooks_icon_style_onto_admin_enqueue(): void {
		$menu = $this->menu();
		$menu->register();

		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $menu, 'enqueue_icon_style' ) ) );
	}

	/**
	 * Enqueuing the icon style hands the menu's stylesheet to the asset service,
	 * which owns handle namespacing and content-hash versioning.
	 */
	public function test_enqueue_icon_style_delegates_to_the_asset_service(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'enqueue' )->once()->with( self::STYLE );

		$this->menu( $assets )->enqueue_icon_style();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * The page renders the plugin name — the only content for now.
	 */
	public function test_render_outputs_plugin_name(): void {
		$menu = $this->menu();

		ob_start();
		$menu->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( 'Battery Surf Bench', $output );
	}
}
