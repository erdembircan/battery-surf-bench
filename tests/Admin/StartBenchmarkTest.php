<?php
/**
 * Tests for the "Start Benchmark" menu entry.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Admin;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Admin\StartBenchmark;
use ErdemBircan\BatterySurfBench\Admin\Views\StartBenchmarkView;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Exception;
use Mockery;

use function has_action;

/**
 * Behavioral tests for the entry's public contract: where it places itself,
 * that both the submenu and admin bar node point at the cockpit, and that its
 * no-JavaScript redirect and nav script wiring behave as documented.
 */
final class StartBenchmarkTest extends TestCase {

	private const PARENT        = 'battery-surf-bench';
	private const PAGE_SLUG     = 'bsb-start-benchmark';
	private const CAPABILITY    = 'manage_options';
	private const COCKPIT_PARAM = 'bsbSession';
	private const COCKPIT_VALUE = 'cockpit';
	private const NAV_SCRIPT    = 'build/admin-start-benchmark.js';
	private const HOOK          = 'battery-surf-bench_page_bsb-start-benchmark';

	/**
	 * Builds an entry with representative configuration.
	 *
	 * @param Assets|null $assets Asset service to inject, mocked when omitted.
	 * @return StartBenchmark The manager under test.
	 */
	private function entry( ?Assets $assets = null ): StartBenchmark {
		return new StartBenchmark(
			self::PARENT,
			self::PAGE_SLUG,
			self::CAPABILITY,
			self::COCKPIT_PARAM,
			self::COCKPIT_VALUE,
			self::NAV_SCRIPT,
			new StartBenchmarkView(),
			$assets ?? Mockery::mock( Assets::class )
		);
	}

	/**
	 * Stubs the WordPress functions the cockpit URL is built from.
	 */
	private function stub_cockpit_url(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.test/' );
		Functions\when( 'add_query_arg' )->alias(
			static fn ( string $key, string $value, string $url ): string => $url . '?' . $key . '=' . $value
		);
		Functions\when( 'esc_url_raw' )->returnArg();
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->entry() );
	}

	/**
	 * Registering the entry hooks its submenu page, its admin bar node and its
	 * nav script onto the admin lifecycle.
	 */
	public function test_register_hooks_page_bar_node_and_assets(): void {
		$entry = $this->entry();
		$entry->register();

		$this->assertNotFalse( has_action( 'admin_menu', array( $entry, 'add_page' ) ) );
		$this->assertNotFalse( has_action( 'admin_bar_menu', array( $entry, 'add_bar_node' ) ) );
		$this->assertNotFalse( has_action( 'admin_enqueue_scripts', array( $entry, 'enqueue' ) ) );
	}

	/**
	 * The entry is placed under the plugin menu, gated by the plugin
	 * capability, rendered by the entry, and its own `load-*` hook is wired to
	 * the redirect — the no-JavaScript fallback that bounces straight to the
	 * cockpit when the page itself is loaded.
	 */
	public function test_add_page_registers_submenu_and_hooks_its_load_redirect(): void {
		$entry = $this->entry();

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

		$entry->add_page();

		$this->assertNotFalse( has_action( 'load-' . self::HOOK, array( $entry, 'redirect' ) ) );
	}

	/**
	 * The redirect sends the browser straight to the cockpit dashboard, then
	 * halts the request. `wp_safe_redirect` is stubbed to throw so control
	 * never reaches the real `exit` call.
	 */
	public function test_redirect_sends_the_browser_to_the_cockpit(): void {
		$this->stub_cockpit_url();

		$sentinel = new Exception( 'redirected' );

		Functions\expect( 'wp_safe_redirect' )
			->once()
			->with( Mockery::pattern( '/bsbSession=cockpit/' ) )
			->andThrow( $sentinel );

		try {
			$this->entry()->redirect();
			$this->fail( 'Expected the sentinel exception to propagate.' );
		} catch ( Exception $caught ) {
			$this->assertSame( $sentinel, $caught );
		}
	}

	/**
	 * With the capability, the admin bar node is added, pointed at the
	 * cockpit, and configured to open it in a new tab — the admin bar's
	 * native counterpart to the submenu's JS-upgraded link.
	 */
	public function test_add_bar_node_adds_a_node_pointing_at_the_cockpit(): void {
		$this->stub_cockpit_url();
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'esc_html__' )->returnArg();

		$wp_admin_bar = Mockery::mock( 'WP_Admin_Bar' );
		$wp_admin_bar->shouldReceive( 'add_node' )
			->once()
			->with(
				Mockery::on(
					static function ( $node ): bool {
						return is_array( $node )
							&& 'bsb-start-benchmark' === $node['id']
							&& '_blank' === $node['meta']['target']
							&& 1 === preg_match( '/bsbSession=cockpit/', $node['href'] );
					}
				)
			);

		$this->entry()->add_bar_node( $wp_admin_bar );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Without the capability, no admin bar node is added — the entry is
	 * invisible to anyone who cannot reach the cockpit.
	 */
	public function test_add_bar_node_skips_users_without_the_capability(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$wp_admin_bar = Mockery::mock( 'WP_Admin_Bar' );
		$wp_admin_bar->shouldReceive( 'add_node' )->never();

		$this->entry()->add_bar_node( $wp_admin_bar );

		$this->addToAssertionCount( 1 );
	}

	/**
	 * Enqueuing drives the asset service end to end: registering the nav
	 * script, localizing the menu slug and cockpit URL onto it, then
	 * enqueuing it. The entry itself never calls WordPress' enqueue functions.
	 */
	public function test_enqueue_registers_localizes_and_enqueues_the_nav_script(): void {
		$this->stub_cockpit_url();

		$assets = Mockery::mock( Assets::class );
		$assets->shouldReceive( 'register_bundle' )
			->once()
			->with( self::NAV_SCRIPT )
			->andReturn( 'bsb-admin-start-benchmark' );
		$assets->shouldReceive( 'localize' )
			->once()
			->with( 'bsb-admin-start-benchmark', 'bsbStartBenchmark', Mockery::type( 'array' ) );
		$assets->shouldReceive( 'enqueue_script' )
			->once()
			->with( 'bsb-admin-start-benchmark' );

		$this->entry( $assets )->enqueue();

		$this->addToAssertionCount( 1 );
	}

	/**
	 * The fallback page — shown only if headers were already sent and the
	 * redirect could not fire — renders the title, message and a link to the
	 * cockpit.
	 */
	public function test_render_outputs_title_message_and_cockpit_link(): void {
		$this->stub_cockpit_url();

		ob_start();
		$this->entry()->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( 'Start Benchmark', $output );
		$this->assertStringContainsString( 'https://example.test/?bsbSession=cockpit', $output );
		$this->assertStringContainsString( 'Open Cockpit', $output );
	}
}
