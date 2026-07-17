<?php
/**
 * Environment-gated dev-tools manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\DevTools;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\DevTools\Views\DevToolsPanelView;
use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function add_filter;
use function array_map;
use function get_option;
use function get_post_field;
use function get_query_var;
use function in_array;
use function sanitize_key;
use function wp_get_environment_type;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the dev-tools panel and its Interactivity script module — active
 * only in a development environment: the PHP gate below decides whether
 * anything is registered at all, and the client ships zero bytes when it is
 * closed (there is no separate JS environment check).
 *
 * When open, the panel and its module load on the cockpit dashboard (front
 * end) only, discovered the same way {@see Cockpit} itself triggers its own
 * rendering — the same query parameter match — so this manager never assumes
 * a URL or markup shape, only the config values that manager is itself built
 * from.
 *
 * The panel's markup is handed to the cockpit dashboard through the
 * `battery_surf_bench_devtools_panel` filter, and its stylesheet survives the
 * cockpit dashboard's asset strip through the
 * `battery_surf_bench_cockpit_spared_style_handles` filter ({@see
 * StandaloneChrome}) — both keep this manager decoupled from the surface it
 * decorates.
 *
 * The Surf group's page stepper shows real course-page slugs (this manager is
 * environment-gated, so it may safely hand the panel identifiers a production
 * surface never leaks): {@see course_slugs()} reads the saved surf-course
 * order from the exact same source {@see \ErdemBircan\BatterySurfBench\Course\CourseRouter}
 * resolves indexes against — the same option, sanitized by the same
 * {@see CourseOrderSanitizer} — so the ordered slug list the panel receives
 * always matches what an index actually resolves to server-side.
 */
class DevTools implements Manager {

	/**
	 * The devtools stylesheet's enqueued handle, once known. Null until
	 * {@see DevTools::enqueue_assets()} has run for the current request.
	 *
	 * @var string|null
	 */
	private ?string $style_handle = null;

	/**
	 * The registered script module's identifier, once known. Null until
	 * {@see DevTools::module_id()} has registered it for the current request.
	 *
	 * @var string|null
	 */
	private ?string $module_id = null;

	/**
	 * Stores everything needed to gate, render and enqueue the dev-tools panel.
	 *
	 * @param array<int, string>   $environments          Environments the gate opens for (matched against `wp_get_environment_type()`).
	 * @param string               $module                Built dev-tools view module, relative to the plugin root.
	 * @param string               $style                 Built dev-tools panel stylesheet, relative to the plugin root.
	 * @param Assets               $assets                Service used to register and enqueue the module and stylesheet.
	 * @param string               $cockpit_param         Query parameter that selects the cockpit dashboard.
	 * @param string               $cockpit_value         Value of the parameter that serves the cockpit.
	 * @param DevToolsPanelView    $view                  View that renders the panel body.
	 * @param CourseOrderSanitizer $course_order_sanitizer Validates the saved surf-course order, the same sanitizer CourseRouter resolves indexes against.
	 * @param string               $course_option_name    Name of the option the surf-course order is saved under.
	 */
	public function __construct(
		private array $environments,
		private string $module,
		private string $style,
		private Assets $assets,
		private string $cockpit_param,
		private string $cockpit_value,
		private DevToolsPanelView $view,
		private CourseOrderSanitizer $course_order_sanitizer,
		private string $course_option_name
	) {
	}

	/**
	 * Whether the dev-tools gate is open for the current environment. Public so
	 * tests and other managers can consult the same switch this manager gates
	 * its own registration on.
	 *
	 * @return bool Whether the current environment is one the gate opens for.
	 */
	public function is_active(): bool {
		return in_array( wp_get_environment_type(), $this->environments, true );
	}

	/**
	 * Hooks the panel's rendering and asset filters, but only when the gate is
	 * open — closed, this manager registers nothing at all, and no dev-tools
	 * byte reaches a production page.
	 *
	 * @return void
	 */
	public function register(): void {
		if ( ! $this->is_active() ) {
			return;
		}

		add_filter( 'battery_surf_bench_devtools_panel', array( $this, 'render_panel' ) );
		add_filter( 'battery_surf_bench_cockpit_spared_style_handles', array( $this, 'spare_style_handle' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_front' ) );
	}

	/**
	 * Enqueues the panel's module and stylesheet on the front end, matching the
	 * exact query parameter {@see Cockpit} itself renders the dashboard on.
	 *
	 * @return void
	 */
	public function enqueue_front(): void {
		if ( $this->cockpit_value !== $this->requested_cockpit_value() ) {
			return;
		}

		$this->enqueue_assets();
	}

	/**
	 * Renders the panel body and appends it to whatever markup the filter
	 * already carries, so the panel composes rather than overwrites another
	 * hooked contribution.
	 *
	 * @param string $panel Markup already gathered by the filter.
	 * @return string The markup with the panel appended.
	 */
	public function render_panel( string $panel = '' ): string {
		return $panel . $this->view->render(
			array(
				'dev_label'               => __( 'DEV', 'battery-surf-bench' ),
				'eyebrow_label'           => __( 'Dev tools', 'battery-surf-bench' ),
				'armed_label'             => __( 'Override active', 'battery-surf-bench' ),
				'reset_label'             => __( 'Reset', 'battery-surf-bench' ),
				'close_label'             => __( 'Close', 'battery-surf-bench' ),
				'battery_label'           => __( 'Battery', 'battery-surf-bench' ),
				'charging_group_label'    => __( 'Charging state', 'battery-surf-bench' ),
				'system_label'            => __( 'System', 'battery-surf-bench' ),
				'charging_label'          => __( 'Charging', 'battery-surf-bench' ),
				'discharging_label'       => __( 'Discharging', 'battery-surf-bench' ),
				'level_label'             => __( 'Battery level override', 'battery-surf-bench' ),
				'discharge_label'         => __( 'Discharge', 'battery-surf-bench' ),
				'from_label'              => __( 'From', 'battery-surf-bench' ),
				'from_decrease_label'     => __( 'Decrease start percentage', 'battery-surf-bench' ),
				'from_increase_label'     => __( 'Increase start percentage', 'battery-surf-bench' ),
				'to_label'                => __( 'To', 'battery-surf-bench' ),
				'to_decrease_label'       => __( 'Decrease end percentage', 'battery-surf-bench' ),
				'to_increase_label'       => __( 'Increase end percentage', 'battery-surf-bench' ),
				'duration_label'          => __( 'Duration', 'battery-surf-bench' ),
				'duration_decrease_label' => __( 'Decrease duration', 'battery-surf-bench' ),
				'duration_increase_label' => __( 'Increase duration', 'battery-surf-bench' ),
				'percent_unit_label'      => __( '%', 'battery-surf-bench' ),
				'minutes_unit_label'      => __( 'min', 'battery-surf-bench' ),
				'start_label'             => __( 'Start', 'battery-surf-bench' ),
				'stop_label'              => __( 'Stop', 'battery-surf-bench' ),
				'surf_label'              => __( 'Surf', 'battery-surf-bench' ),
				'natural_label'           => __( 'Natural', 'battery-surf-bench' ),
				'sterile_label'           => __( 'Sterile', 'battery-surf-bench' ),
				'auction_override_label'  => __( 'Auction override', 'battery-surf-bench' ),
				'page_label'              => __( 'Page', 'battery-surf-bench' ),
				'page_prev_label'         => __( 'Previous course page', 'battery-surf-bench' ),
				'page_next_label'         => __( 'Next course page', 'battery-surf-bench' ),
				'behavior_keys'           => array(
					'scrollBurst',
					'readPause',
					'glanceBack',
					'watchVideo',
					'lingerImage',
					'fidgetWiggle',
					'microScroll',
					'selectSnippet',
					'moveOn',
				),
				'course_slugs'            => $this->course_slugs(),
			)
		);
	}

	/**
	 * The saved surf-course order's slugs, in visit order — read from the
	 * exact same option, and sanitized by the exact same
	 * {@see CourseOrderSanitizer}, that CourseRouter resolves indexes
	 * against, so the ordered list handed to the panel always matches what
	 * an index actually resolves to server-side. A bundled entry's own slug
	 * names it directly; a user entry resolves to the real post's own slug.
	 *
	 * @return array<int, string> The ordered course-page slugs.
	 */
	private function course_slugs(): array {
		$order = $this->course_order_sanitizer->sanitize(
			get_option( $this->course_option_name, $this->course_order_sanitizer->default_order() )
		);

		return array_map(
			function ( array $entry ): string {
				return 'bundled' === $entry['kind']
					? (string) $entry['slug']
					: (string) get_post_field( 'post_name', $entry['id'] );
			},
			$order
		);
	}

	/**
	 * Adds the devtools stylesheet's handle to the cockpit dashboard's spared
	 * style handles, so the strip that clears every other stylesheet leaves it
	 * in place.
	 *
	 * @param array<int, string> $handles Style handles already spared.
	 * @return array<int, string> The handles with the devtools stylesheet added, once known.
	 */
	public function spare_style_handle( array $handles ): array {
		if ( null !== $this->style_handle ) {
			$handles[] = $this->style_handle;
		}

		return $handles;
	}

	/**
	 * Resolves the cockpit parameter's requested value, the same way
	 * {@see Cockpit::requested_value()} resolves it for the dashboard route
	 * itself.
	 *
	 * @return string The sanitized value, or '' when the parameter is absent.
	 */
	private function requested_cockpit_value(): string {
		return sanitize_key( (string) get_query_var( $this->cockpit_param ) );
	}

	/**
	 * Enqueues the devtools stylesheet and the view module (registering its
	 * translations before marking it for output), so the two enqueue call
	 * sites above stay a single source of truth.
	 *
	 * @return void
	 */
	private function enqueue_assets(): void {
		$this->style_handle = $this->assets->enqueue( $this->style );

		$module_id = $this->module_id();
		$this->assets->enqueue_script_module( $module_id );
	}

	/**
	 * Registers the dev-tools view module (once per request) and its
	 * translations, returning its identifier.
	 *
	 * @return string The registered module's identifier.
	 */
	private function module_id(): string {
		if ( null === $this->module_id ) {
			$this->module_id = $this->assets->register_script_module(
				$this->module,
				array( '@wordpress/interactivity' )
			);
			$this->assets->set_script_module_translations( $this->module_id );
		}

		return $this->module_id;
	}
}
