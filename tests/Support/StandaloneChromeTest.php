<?php
/**
 * Tests for the standalone-document chrome.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Support;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Core\Assets;
use ErdemBircan\BatterySurfBench\Support\StandaloneChrome;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;
use WP_Scripts;
use WP_Styles;

use function has_action;
use function has_filter;

/**
 * The chrome turns a request into a clean standalone document. Its observable
 * contract: enqueue the one stylesheet the page keeps, dequeue every other
 * classic style and script — sparing that stylesheet and any handles its filter
 * opts back in — and wire those steps onto the asset hook. The full head/footer
 * teardown and header send are exercised end-to-end in the Playground, not here.
 */
final class StandaloneChromeTest extends TestCase {

	private const STYLE                = 'build/style-cockpit-dashboard.css';
	private const STYLE_HANDLE         = 'bsb-cockpit';
	private const SPARED_SCRIPT_FILTER = 'battery_surf_bench_cockpit_spared_script_handles';
	private const SPARED_STYLE_FILTER  = 'battery_surf_bench_cockpit_spared_style_handles';

	/**
	 * Builds the chrome under test.
	 *
	 * @param Assets|null $assets Asset service to inject; a dummy mock by default.
	 * @return StandaloneChrome The chrome.
	 */
	private function chrome( ?Assets $assets = null ): StandaloneChrome {
		return new StandaloneChrome(
			$assets ?? Mockery::mock( Assets::class ),
			self::STYLE
		);
	}

	/**
	 * The page's stylesheet is enqueued through the asset service, so the
	 * stripped document still has the one style it is meant to keep.
	 */
	public function test_enqueue_style_enqueues_the_kept_stylesheet(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->expects( 'enqueue' )->once()->with( self::STYLE )->andReturn( self::STYLE_HANDLE );

		$this->chrome( $assets )->enqueue_style();

		// The Mockery expectation above is the assertion; acknowledge it so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * The strip clears every other enqueued style but spares the kept one, so the
	 * theme's CSS is gone while the page keeps its own.
	 */
	public function test_dequeue_all_assets_spares_the_kept_stylesheet(): void {
		$assets = Mockery::mock( Assets::class );
		$assets->expects( 'enqueue' )->andReturn( self::STYLE_HANDLE );

		$wp_styles        = new WP_Styles();
		$wp_styles->queue = array( 'theme-style', self::STYLE_HANDLE, 'another-plugin' );

		$GLOBALS['wp_styles']  = $wp_styles;
		$GLOBALS['wp_scripts'] = null;

		Functions\expect( 'apply_filters' )
			->once()
			->with( self::SPARED_STYLE_FILTER, array() )
			->andReturn( array() );

		Functions\expect( 'wp_dequeue_style' )->once()->with( 'theme-style' );
		Functions\expect( 'wp_dequeue_style' )->once()->with( 'another-plugin' );
		Functions\expect( 'wp_dequeue_style' )->never()->with( self::STYLE_HANDLE );

		$chrome = $this->chrome( $assets );
		$chrome->enqueue_style();
		$chrome->dequeue_all_assets();

		unset( $GLOBALS['wp_styles'], $GLOBALS['wp_scripts'] );

		// The Mockery expectations above are the assertions; acknowledge them so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 4 );
	}

	/**
	 * Style handles returned through the chrome's style filter survive the strip,
	 * alongside the kept stylesheet. The dev-tools panel relies on this so its
	 * stylesheet still loads on the stripped cockpit dashboard.
	 */
	public function test_dequeue_all_assets_spares_filtered_style_handles(): void {
		$wp_styles        = new WP_Styles();
		$wp_styles->queue = array( 'theme-style', 'bsb-devtools', 'another-plugin' );

		$GLOBALS['wp_styles']  = $wp_styles;
		$GLOBALS['wp_scripts'] = null;

		Functions\expect( 'apply_filters' )
			->once()
			->with( self::SPARED_STYLE_FILTER, array() )
			->andReturn( array( 'bsb-devtools' ) );

		Functions\expect( 'wp_dequeue_style' )->once()->with( 'theme-style' );
		Functions\expect( 'wp_dequeue_style' )->once()->with( 'another-plugin' );
		Functions\expect( 'wp_dequeue_style' )->never()->with( 'bsb-devtools' );

		$this->chrome()->dequeue_all_assets();

		unset( $GLOBALS['wp_styles'], $GLOBALS['wp_scripts'] );

		// The Mockery expectations above are the assertions; acknowledge them so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 3 );
	}

	/**
	 * By default the strip dequeues every classic script, so no theme or plugin
	 * JS reaches the standalone document.
	 */
	public function test_dequeue_all_assets_dequeues_every_script_by_default(): void {
		$wp_scripts        = new WP_Scripts();
		$wp_scripts->queue = array( 'theme-script', 'another-plugin' );

		$GLOBALS['wp_styles']  = null;
		$GLOBALS['wp_scripts'] = $wp_scripts;

		Functions\expect( 'apply_filters' )
			->once()
			->with( self::SPARED_SCRIPT_FILTER, array() )
			->andReturn( array() );

		Functions\expect( 'wp_dequeue_script' )->once()->with( 'theme-script' );
		Functions\expect( 'wp_dequeue_script' )->once()->with( 'another-plugin' );

		$this->chrome()->dequeue_all_assets();

		unset( $GLOBALS['wp_styles'], $GLOBALS['wp_scripts'] );

		// The Mockery expectations above are the assertions; acknowledge them so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 3 );
	}

	/**
	 * Script handles returned through the chrome's filter survive the strip. Dev
	 * tooling (the Playground LiveReload client) relies on this so file changes
	 * still reload the page in place.
	 */
	public function test_dequeue_all_assets_spares_filtered_script_handles(): void {
		$wp_scripts        = new WP_Scripts();
		$wp_scripts->queue = array( 'theme-script', 'bsb-live-reload', 'another-plugin' );

		$GLOBALS['wp_styles']  = null;
		$GLOBALS['wp_scripts'] = $wp_scripts;

		Functions\expect( 'apply_filters' )
			->once()
			->with( self::SPARED_SCRIPT_FILTER, array() )
			->andReturn( array( 'bsb-live-reload' ) );

		Functions\expect( 'wp_dequeue_script' )->once()->with( 'theme-script' );
		Functions\expect( 'wp_dequeue_script' )->once()->with( 'another-plugin' );
		Functions\expect( 'wp_dequeue_script' )->never()->with( 'bsb-live-reload' );

		$this->chrome()->dequeue_all_assets();

		unset( $GLOBALS['wp_styles'], $GLOBALS['wp_scripts'] );

		// The Mockery expectations above are the assertions; acknowledge them so
		// PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 3 );
	}

	/**
	 * Engaging wires the enqueue and the strip onto the asset hook and hides the
	 * admin bar, so a page that engages the chrome renders stripped without
	 * managing those hooks itself.
	 */
	public function test_engage_wires_the_enqueue_strip_and_admin_bar(): void {
		Functions\when( 'nocache_headers' )->justReturn( null );
		Functions\when( 'remove_all_actions' )->justReturn( true );
		$modules = Mockery::mock();
		$modules->shouldReceive( 'add_hooks' )->once();
		Functions\when( 'wp_script_modules' )->justReturn( $modules );

		$chrome = $this->chrome();
		$chrome->engage();

		$this->assertNotFalse( has_filter( 'show_admin_bar', '__return_false' ) );
		$this->assertNotFalse( has_action( 'wp_enqueue_scripts', array( $chrome, 'enqueue_style' ) ) );
		$this->assertNotFalse( has_action( 'wp_enqueue_scripts', array( $chrome, 'dequeue_all_assets' ) ) );
	}
}
