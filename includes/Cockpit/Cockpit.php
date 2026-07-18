<?php
/**
 * Cockpit block + dashboard route.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Cockpit;

use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Core\Assets;
use ErdemBircan\BatterySurfBench\Support\CapabilityInterface;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\StandaloneChrome;

use function __;
use function add_action;
use function add_filter;
use function add_query_arg;
use function apply_filters;
use function do_blocks;
use function esc_html__;
use function esc_url;
use function esc_url_raw;
use function generate_block_asset_handle;
use function get_query_var;
use function home_url;
use function register_block_type;
use function rest_url;
use function sanitize_key;
use function sprintf;
use function wp_create_nonce;
use function wp_die;
use function wp_interactivity_config;
use function wp_kses_post;
use function wp_login_url;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the cockpit block and serves the dashboard it lives on off a URL
 * parameter (`?bsbSession=cockpit`) — never a seeded page. When that parameter
 * is hit by an administrator, the cockpit is rendered as a standalone document:
 * the classic style and script queues are emptied so no theme or other-plugin
 * CSS/JS gets in the dashboard's way — bar the cockpit's own stylesheet, which
 * is enqueued and spared — while the block's Interactivity API view (a script
 * module, a separate registry) is left to load and hydrate the viewport iframe.
 *
 * The client is fed no page data at all — no ids, URLs, titles, order, or
 * count. The cockpit's `RunStore` holds only an incrementing index counter;
 * {@see \ErdemBircan\BatterySurfBench\Course\CourseRouter} resolves which
 * page an index names entirely server-side, gated on a `bsb_surf` nonce this
 * class mints (see {@see configure_rest_access()}) alongside the site's home
 * URL, so the viewport's index-request URLs are assembled client-side from
 * seeded configuration rather than a bound page list.
 */
class Cockpit implements Manager {

	/**
	 * Stores everything needed to register the block and serve its dashboard.
	 *
	 * @param string              $block_dir         Absolute path to the built block directory holding its `block.json`.
	 * @param string              $block_name        The block's registered name (e.g. `bsb/cockpit`).
	 * @param string              $param             Query parameter that selects the cockpit dashboard.
	 * @param string              $value             Value of the parameter that serves the cockpit.
	 * @param CapabilityInterface $capability        Capability required to open the cockpit.
	 * @param CockpitDashboard    $dashboard         View that renders the standalone dashboard document.
	 * @param Assets              $assets            Service used to register the view module's translations.
	 * @param string              $session_post_type Post type sessions are stored as, exposed to the cockpit so it can POST a finished run to that REST collection.
	 * @param string              $surf_nonce_action Nonce action the surf nonce seeded to the client is minted under; {@see \ErdemBircan\BatterySurfBench\Course\CourseRouter} verifies index requests against the same action.
	 * @param StandaloneChrome    $chrome            Strips the front end so the dashboard renders as a clean standalone document.
	 */
	public function __construct(
		private string $block_dir,
		private string $block_name,
		private string $param,
		private string $value,
		private CapabilityInterface $capability,
		private CockpitDashboard $dashboard,
		private Assets $assets,
		private string $session_post_type,
		private string $surf_nonce_action,
		private StandaloneChrome $chrome
	) {
	}

	/**
	 * Declares the dashboard query parameter, registers the block, and hooks
	 * the dashboard route.
	 *
	 * @return void
	 */
	public function register(): void {
		add_filter( 'query_vars', array( $this, 'add_query_var' ) );
		add_action( 'init', array( $this, 'register_block' ) );
		add_action( 'template_redirect', array( $this, 'maybe_render' ), 1 );
	}

	/**
	 * Registers the cockpit block from its built `block.json`, which wires in
	 * the server render template and the Interactivity API view module, then
	 * registers that module's translations so its `@wordpress/i18n` strings
	 * localize. The module id WordPress derives for the block's `viewScriptModule`
	 * is recomputed with core's own helper so it stays in step with however core
	 * names it.
	 *
	 * @return void
	 */
	public function register_block(): void {
		register_block_type( $this->block_dir );

		$this->assets->set_script_module_translations(
			generate_block_asset_handle( $this->block_name, 'viewScriptModule' )
		);
	}

	/**
	 * Declares the cockpit query parameter so WordPress parses it off the URL.
	 *
	 * @param array<int, string> $vars Registered public query vars.
	 * @return array<int, string> The query vars with the cockpit parameter added.
	 */
	public function add_query_var( array $vars ): array {
		$vars[] = $this->param;

		return $vars;
	}

	/**
	 * Serves the cockpit dashboard when its parameter is requested. Gated to the
	 * plugin capability; renders a standalone, theme-stripped document and exits.
	 *
	 * @return void
	 */
	public function maybe_render(): void {
		if ( $this->value !== $this->requested_value() ) {
			return;
		}

		if ( ! $this->capability->allows() ) {
			$this->deny();
		}

		$this->configure_rest_access();
		$this->chrome->engage();

		$data = array(
			'body'           => do_blocks( $this->host_markup() ),
			// Empty by default; the DevTools manager (dev environments only) hooks
			// this to append its already-escaped, pre-rendered panel markup. Kept
			// as a filter rather than a constructor dependency so the cockpit
			// stays ignorant of dev-only chrome.
			'devtools_panel' => apply_filters( 'battery_surf_bench_devtools_panel', '' ),
		);

		// The dashboard view returns a complete, trusted HTML document — escaped
		// attributes, do_blocks() output and wp_head()/wp_footer() — that no
		// WordPress escaping function can be applied to without breaking it.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-rendered document; see comment above.
		echo $this->dashboard->render( $data );

		exit;
	}

	/**
	 * Resolves the cockpit parameter's value from the registered query parameter.
	 * The parameter is a public query var ({@see Cockpit::add_query_var()}), so
	 * WordPress parses it off the URL and exposes it through `get_query_var()` —
	 * no need to read the superglobal.
	 *
	 * @return string The sanitized value, or '' when the parameter is absent.
	 */
	private function requested_value(): string {
		return sanitize_key( (string) get_query_var( $this->param ) );
	}

	/**
	 * Hands the cockpit's Interactivity store what it needs to persist a
	 * finished run and to surf the saved course: the full session-collection
	 * REST URL and a `wp_rest` nonce, plus the site's home URL and a
	 * `bsb_surf` nonce so `RunStore.currentSrc` can build each
	 * `?bsbSurfIndex=<n>&bsbNonce=<nonce>` viewport request without the
	 * client ever holding a page list. The backend builds the complete REST
	 * endpoint URL (route namespace included) so the client never assembles
	 * it — if the route ever moves, only this server side changes. The
	 * cockpit is a script module, so this travels through
	 * `wp_interactivity_config()` (read client-side with `getConfig()`)
	 * rather than `wp_localize_script`. Set only on the gated dashboard
	 * route, after the administrator check, so both nonces are minted for
	 * the very user authorized to act on them — the session post type's
	 * capability map/meta `auth_callback` and
	 * {@see \ErdemBircan\BatterySurfBench\Course\CourseRouter}'s own
	 * capability check still gate the respective write/read server-side;
	 * each nonce only proves request intent.
	 *
	 * @return void
	 */
	private function configure_rest_access(): void {
		wp_interactivity_config(
			$this->block_name,
			array(
				'restUrl'   => esc_url_raw( rest_url( 'wp/v2/' . $this->session_post_type ) ),
				'restNonce' => wp_create_nonce( 'wp_rest' ),
				'surfBase'  => esc_url_raw( home_url( '/' ) ),
				'surfNonce' => wp_create_nonce( $this->surf_nonce_action ),
			)
		);
	}

	/**
	 * Builds the cockpit block markup. The block carries no page data of its
	 * own — the client-side store builds each viewport request from the
	 * seeded index-route configuration (see {@see configure_rest_access()})
	 * rather than a bound page list.
	 *
	 * @return string The serialized block markup.
	 */
	private function host_markup(): string {
		return sprintf( '<!-- wp:%s /-->', $this->block_name );
	}

	/**
	 * Denies access to a non-administrator with a login link back to the
	 * cockpit, then halts the request.
	 *
	 * @return void
	 */
	private function deny(): void {
		$login = wp_login_url( add_query_arg( $this->param, $this->value, home_url( '/' ) ) );

		wp_die(
			wp_kses_post(
				sprintf(
					/* translators: %s: login URL. */
					__( 'The cockpit requires an administrator. Please <a href="%s">log in</a>.', 'battery-surf-bench' ),
					esc_url( $login )
				)
			),
			esc_html__( 'Battery Surf Bench', 'battery-surf-bench' ),
			array( 'response' => 403 )
		);
	}
}
