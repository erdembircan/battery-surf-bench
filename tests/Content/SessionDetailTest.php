<?php
/**
 * Tests for the stored-session detail route.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Content;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView;
use ErdemBircan\BatterySurfBench\Content\SessionDetail;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\StandaloneChrome;
use ErdemBircan\BatterySurfBench\Tests\TestCase;
use Mockery;

use function has_action;

/**
 * The detail route serves one stored session at its permalink. Its observable
 * contract here: hook `template_redirect`, ignore requests that are not a single
 * session, and 404 a single session the visitor may not view — so the queryable
 * type reveals nothing to the unauthorized. The render-and-exit path for an
 * authorized view is exercised end-to-end in the Playground, not here, since it
 * ends in `exit`.
 */
final class SessionDetailTest extends TestCase {

	private const POST_TYPE   = 'bsb_session';
	private const PREFIX      = 'bsb_';
	private const CAPABILITY  = 'manage_options';
	private const BLOCK_NAME  = 'bsb/cockpit';
	private const SCREEN_SLUG = 'bsb-sessions';

	/**
	 * Builds the detail route under test.
	 *
	 * @return SessionDetail The manager.
	 */
	private function route(): SessionDetail {
		return new SessionDetail(
			self::POST_TYPE,
			self::PREFIX,
			self::CAPABILITY,
			self::BLOCK_NAME,
			self::SCREEN_SLUG,
			new CockpitDashboard(),
			new SessionDetailView(),
			new StandaloneChrome(
				Mockery::mock( Assets::class ),
				'build/style-cockpit-dashboard.css'
			)
		);
	}

	/**
	 * The bootstrap relies on every manager honouring the contract.
	 */
	public function test_is_a_manager(): void {
		$this->assertInstanceOf( Manager::class, $this->route() );
	}

	/**
	 * The route is deferred to `template_redirect`, early enough to render and
	 * exit before the theme takes over.
	 */
	public function test_register_hooks_the_route_onto_template_redirect(): void {
		$route = $this->route();
		$route->register();

		$this->assertNotFalse( has_action( 'template_redirect', array( $route, 'maybe_render' ) ) );
	}

	/**
	 * A request that is not a single session is left untouched — the route never
	 * looks past the `is_singular` check, so ordinary pages render normally.
	 */
	public function test_maybe_render_ignores_non_session_requests(): void {
		Functions\when( 'is_singular' )->justReturn( false );
		Functions\expect( 'get_queried_object_id' )->never();

		$this->route()->maybe_render();

		// Reaching here without touching the queried object proves the early
		// return; acknowledge it so PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 1 );
	}

	/**
	 * A single session the visitor may not view is turned into a 404, so a session
	 * URL reveals nothing to the unauthorized despite the type being queryable.
	 */
	public function test_maybe_render_404s_a_session_for_an_unauthorized_visitor(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 7 );
		Functions\when( 'current_user_can' )->justReturn( false );
		Functions\when( 'nocache_headers' )->justReturn( null );

		$wp_query = Mockery::mock();
		$wp_query->shouldReceive( 'set_404' )->once();
		$GLOBALS['wp_query'] = $wp_query;

		Functions\expect( 'status_header' )->once()->with( 404 );

		$this->route()->maybe_render();

		unset( $GLOBALS['wp_query'] );

		// The set_404 and status_header expectations are the assertions;
		// acknowledge them so PHPUnit does not flag the test as risky.
		$this->addToAssertionCount( 2 );
	}
}
