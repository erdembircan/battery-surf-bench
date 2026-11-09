<?php
/**
 * Stored-session detail screen.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

use ErdemBircan\BatterySurfBench\Cockpit\SummaryReasons;
use ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView;
use ErdemBircan\BatterySurfBench\Core\Assets;
use ErdemBircan\BatterySurfBench\Support\AllowedHtml;
use ErdemBircan\BatterySurfBench\Support\CapabilityInterface;
use ErdemBircan\BatterySurfBench\Support\Manager;
use WP_Post;

use function __;
use function add_action;
use function add_filter;
use function add_submenu_page;
use function admin_url;
use function esc_html__;
use function esc_url;
use function filter_input;
use function generate_block_asset_handle;
use function get_current_screen;
use function get_post;
use function get_post_meta;
use function is_int;
use function is_string;
use function remove_submenu_page;
use function wp_die;
use function wp_enqueue_script_module;
use function wp_kses;

defined( 'ABSPATH' ) || exit;

/**
 * Shows one stored session's summary postcard on its own admin page.
 *
 * Sessions have no native admin screens (see {@see SessionType}), so this
 * manager registers a page under the plugin menu, hidden from the menu itself,
 * at `admin.php?page=<slug>&<param>=<id>`. The listing opens each row there.
 * WordPress prints the admin chrome around it like any other plugin page; this
 * page prints only the postcard, and keeps **Sessions** highlighted in the menu
 * while it shows.
 *
 * The view is the live cockpit's summary card ({@see SessionDetailView}) running
 * on the `battery-surf-bench/cockpit` Interactivity store: this page seeds the
 * run's frozen readouts onto the per-instance context from the stored meta and
 * enqueues the cockpit's view module so the card hydrates, rebuilds the drain
 * graph and auto-flips itself — the same component the dashboard shows at run
 * end.
 */
class SessionDetail implements Manager {

	/**
	 * The admin page hook the page renders on, captured at registration so assets
	 * only load there and the menu highlight can tell the page apart.
	 *
	 * @var string
	 */
	private string $hook_suffix = '';

	/**
	 * The id of the session the page is showing, resolved when the page loads.
	 *
	 * @var int
	 */
	private int $session_id = 0;

	/**
	 * Stores everything needed to place, gate, style and render a session detail page.
	 *
	 * @param string              $post_type   Post type sessions are stored as.
	 * @param string              $meta_prefix Prefix every session meta key carries.
	 * @param CapabilityInterface $capability  Capability required to view a session.
	 * @param string              $block_name  Cockpit block name, for its view-module handle.
	 * @param string              $parent_slug Slug of the plugin menu the page is registered under.
	 * @param string              $page_slug   Slug that identifies the detail page.
	 * @param string              $screen_slug Listing screen slug the back link points at and the menu highlight falls on.
	 * @param string              $param       URL parameter carrying the session id.
	 * @param string              $style       Stylesheet carrying the postcard styles (the cockpit stylesheet), relative to the plugin root.
	 * @param SessionDetailView   $view        View that renders the summary postcard body.
	 * @param Assets              $assets      Service used to enqueue the detail stylesheet.
	 */
	public function __construct(
		private string $post_type,
		private string $meta_prefix,
		private CapabilityInterface $capability,
		private string $block_name,
		private string $parent_slug,
		private string $page_slug,
		private string $screen_slug,
		private string $param,
		private string $style,
		private SessionDetailView $view,
		private Assets $assets
	) {
	}

	/**
	 * Hooks the page registration, its removal from the menu, the menu highlight
	 * and the page's assets into the admin lifecycle.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_head', array( $this, 'hide_page' ) );
		add_filter( 'submenu_file', array( $this, 'highlight_listing' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Adds the detail page under the plugin menu and records its hook, so assets
	 * load only there and the page resolves its session before any output.
	 *
	 * @return void
	 */
	public function add_page(): void {
		$hook_suffix = add_submenu_page(
			$this->parent_slug,
			__( 'Benchmark Session', 'battery-surf-bench' ),
			__( 'Benchmark Session', 'battery-surf-bench' ),
			$this->capability->slug(),
			$this->page_slug,
			array( $this, 'render' )
		);

		$this->hook_suffix = is_string( $hook_suffix ) ? $hook_suffix : '';

		if ( '' !== $this->hook_suffix ) {
			add_action( 'load-' . $this->hook_suffix, array( $this, 'load' ) );
		}
	}

	/**
	 * Takes the detail page out of the plugin menu. The page stays registered, so
	 * its URL keeps working and WordPress still gates it by capability; it only
	 * has no menu item of its own. Runs on `admin_head`, after WordPress has
	 * resolved the requested page against the menu.
	 *
	 * @return void
	 */
	public function hide_page(): void {
		remove_submenu_page( $this->parent_slug, $this->page_slug );
	}

	/**
	 * Keeps the listing's menu item highlighted while the detail page shows, since
	 * the page has no item of its own to highlight.
	 *
	 * @param string|null $submenu_file The submenu file WordPress would highlight.
	 * @return string|null The listing's slug on the detail page, otherwise the file unchanged.
	 */
	public function highlight_listing( $submenu_file ) {
		$screen = get_current_screen();

		if ( null !== $screen && '' !== $this->hook_suffix && $screen->id === $this->hook_suffix ) {
			return $this->screen_slug;
		}

		return $submenu_file;
	}

	/**
	 * Resolves the requested session when the detail page loads, before WordPress
	 * prints anything. An unknown id, or an id of some other post type, ends the
	 * request with a 404 page that links back to the listing. Also blanks the
	 * admin footer text on this page only: the postcard fills the whole panel, so
	 * the "Thank you for creating with WordPress" and version lines have no place
	 * here. The footer element still renders (its `admin_print_footer_scripts` is
	 * what prints the Interactivity module that hydrates the card); only its
	 * wording is cleared.
	 *
	 * @return void
	 */
	public function load(): void {
		$session_id = filter_input( INPUT_GET, $this->param, FILTER_VALIDATE_INT );
		$session    = is_int( $session_id ) ? get_post( $session_id ) : null;

		if ( ! $session instanceof WP_Post || $session->post_type !== $this->post_type ) {
			wp_die(
				esc_html__( 'That benchmark session doesn’t exist. It may have been deleted.', 'battery-surf-bench' ),
				esc_html__( 'Session not found', 'battery-surf-bench' ),
				array(
					'response'  => 404,
					'link_url'  => esc_url( admin_url( 'admin.php?page=' . $this->screen_slug ) ),
					'link_text' => esc_html__( 'Back to sessions', 'battery-surf-bench' ),
				)
			);

			return;
		}

		$this->session_id = $session->ID;

		add_filter( 'admin_footer_text', '__return_empty_string', 11 );
		add_filter( 'update_footer', '__return_empty_string', 11 );
	}

	/**
	 * Prints the detail page: the session's summary postcard, inside the admin
	 * chrome WordPress prints around it.
	 *
	 * @return void
	 */
	public function render(): void {
		echo wp_kses( $this->view->render( $this->view_data( $this->session_id ) ), AllowedHtml::tags() );
	}

	/**
	 * Enqueues the detail stylesheet and the cockpit view module on the detail
	 * page, so the postcard is styled and hydrates. A no-op on every other admin
	 * screen.
	 *
	 * @param string $hook_suffix The current admin page's hook suffix.
	 * @return void
	 */
	public function enqueue( string $hook_suffix ): void {
		if ( '' === $this->hook_suffix || $hook_suffix !== $this->hook_suffix ) {
			return;
		}

		$this->assets->enqueue( $this->style );
		wp_enqueue_script_module( generate_block_asset_handle( $this->block_name, 'viewScriptModule' ) );
	}

	/**
	 * Builds the view data for a session: the seeded Interactivity context (the
	 * run's frozen readouts and its samples) and the raw translated labels the
	 * summary card and the page chrome render.
	 *
	 * @param int $session_id The session post id.
	 * @return array<string, mixed> The view data.
	 */
	private function view_data( int $session_id ): array {
		return array(
			'context'            => $this->context_for( $session_id ),
			'greeting_lead'      => __( 'Greetings from', 'battery-surf-bench' ),
			'brand_title'        => __( 'Battery Surf Bench', 'battery-surf-bench' ),
			'summary_brand'      => __( 'BATTERY · SURF · BENCH', 'battery-surf-bench' ),
			'flip_label'         => __( 'Flip', 'battery-surf-bench' ),
			'tte_label'          => __( '100% → 0%', 'battery-surf-bench' ),
			'rate_session_label' => __( 'Rate · session', 'battery-surf-bench' ),
			'rate10_label'       => __( 'Rate · 10 min', 'battery-surf-bench' ),
			'battery_label'      => __( 'Battery', 'battery-surf-bench' ),
			'dropped_label'      => __( 'Dropped', 'battery-surf-bench' ),
			'pts_label'          => __( 'pts', 'battery-surf-bench' ),
			'elapsed_run_label'  => __( 'Elapsed', 'battery-surf-bench' ),
			'measured_label'     => __( 'Measured', 'battery-surf-bench' ),
			'projected_label'    => __( 'Projected 100 → 0', 'battery-surf-bench' ),
			'back_label'         => __( 'Back to sessions', 'battery-surf-bench' ),
			'back_url'           => admin_url( 'admin.php?page=' . $this->screen_slug ),
		);
	}

	/**
	 * Seeds the run's frozen readouts onto the cockpit context. Mirrors what the
	 * live run freezes at run end, read back from the stored meta: the verdict's
	 * end reason, the battery start/end and drop, the rate readouts (a stored zero
	 * marks an unmeasurable figure, seeded as null so it reads as an em dash), the
	 * target, and the run-length-encoded samples the card rebuilds the drain graph
	 * from on hydration.
	 *
	 * @param int $session_id The session post id.
	 * @return array<string, mixed> The seeded Interactivity context.
	 */
	private function context_for( int $session_id ): array {
		$start_level = (float) $this->meta( $session_id, 'start_level' );
		$end_level   = (float) $this->meta( $session_id, 'end_level' );
		$dropped     = (float) $this->meta( $session_id, 'dropped_pct' );

		return array(
			'ended'               => true,
			'flipped'             => false,
			'endReason'           => $this->end_reason( $session_id ),
			'reasonText'          => SummaryReasons::text(),
			'summaryBatteryStart' => (string) (int) round( $start_level * 100 ),
			'summaryBatteryEnd'   => (string) (int) round( $end_level * 100 ),
			'summaryDropped'      => (string) (int) round( $dropped ),
			'elapsed'             => (int) $this->meta( $session_id, 'elapsed' ),
			'rate10'              => $this->positive_or_null( (float) $this->meta( $session_id, 'rate_10' ) ),
			'rateSession'         => $this->positive_or_null( (float) $this->meta( $session_id, 'rate_session' ) ),
			'secondsToEmpty'      => $this->positive_or_null( (float) $this->meta( $session_id, 'time_to_empty' ) ),
			'targetPercent'       => (int) $this->meta( $session_id, 'config_target_percent' ),
			// Built client-side by `callbacks.initDetail` from the samples below;
			// the chart geometry is TypeScript, so the server cannot precompute it.
			'hasGraph'            => false,
			'graphJson'           => '',
			'detailSamples'       => $this->samples( $session_id ),
		);
	}

	/**
	 * Maps a stored session's lifecycle status (and its configured mode) back to
	 * the cockpit's run-end reason, which drives the summary's verdict wording.
	 *
	 * @param int $session_id The session post id.
	 * @return string The run-end reason key.
	 */
	private function end_reason( int $session_id ): string {
		$status = (string) $this->meta( $session_id, 'status' );

		if ( 'stopped' === $status ) {
			return 'stopped';
		}

		if ( 'aborted' === $status ) {
			return 'plugged';
		}

		if ( 'failed' === $status ) {
			return 'loadError';
		}

		// A finished run completed its mode: a target-drop run hit its mark, a
		// duration run ran its length.
		return 'targetDrop' === $this->meta( $session_id, 'config_mode' )
			? 'targetDrop'
			: 'duration';
	}

	/**
	 * Reads the run's samples for the drain graph, as the flat `{ t, level,
	 * charging }` points the chart builder fits over (the stored run-length-
	 * encoded log is a superset; its `count` field is no part of the geometry).
	 *
	 * @param int $session_id The session post id.
	 * @return array<int, array<string, float|bool>> The samples.
	 */
	private function samples( int $session_id ): array {
		$stored = $this->meta( $session_id, 'samples' );

		if ( ! is_array( $stored ) ) {
			return array();
		}

		$samples = array();

		foreach ( $stored as $sample ) {
			if ( ! is_array( $sample ) || ! isset( $sample['t'], $sample['level'] ) ) {
				continue;
			}

			$samples[] = array(
				't'        => (float) $sample['t'],
				'level'    => (float) $sample['level'],
				'charging' => (bool) ( $sample['charging'] ?? false ),
			);
		}

		return $samples;
	}

	/**
	 * Reads a single session meta value by its bare field name.
	 *
	 * @param int    $session_id The session post id.
	 * @param string $field      Bare field name (e.g. `status`).
	 * @return mixed The stored meta value.
	 */
	private function meta( int $session_id, string $field ) {
		return get_post_meta( $session_id, $this->meta_prefix . $field, true );
	}

	/**
	 * Returns a positive figure unchanged, or null for a non-positive one — the
	 * marker a run stored for a rate or projection it could not measure, which the
	 * summary then reads as an em dash rather than a misleading zero.
	 *
	 * @param float $value The stored figure.
	 * @return float|null The figure when positive, otherwise null.
	 */
	private function positive_or_null( float $value ): ?float {
		return $value > 0 ? $value : null;
	}
}
