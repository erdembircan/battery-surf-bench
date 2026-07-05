<?php
/**
 * Stored-session detail screen.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

use ErdemBircan\BatterySurfBench\Assets;
use ErdemBircan\BatterySurfBench\Cockpit\SummaryReasons;
use ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView;
use ErdemBircan\BatterySurfBench\Support\Manager;
use WP_Post;

use function __;
use function add_action;
use function add_filter;
use function admin_url;
use function apply_filters;
use function current_user_can;
use function did_action;
use function generate_block_asset_handle;
use function get_current_screen;
use function get_post_meta;
use function wp_enqueue_script_module;
use function wp_interactivity_data_wp_context;

defined( 'ABSPATH' ) || exit;

/**
 * Renders the summary postcard on each session's native admin edit screen.
 *
 * Sessions have a native admin UI (see {@see SessionType}) but no useful block
 * editor, so this route replaces the editor with the run-summary postcard: the
 * `replace_editor` filter swaps the editor body for the detail view while the
 * admin chrome (menu, toolbar, footer) renders around it, so a session opens
 * through the ordinary WordPress flow — click a row in the listing, land on the
 * post's own admin URL — but shows a custom display.
 *
 * The view is the live cockpit's summary card ({@see SessionDetailView}) running
 * on the `bsb/cockpit` Interactivity store: this route seeds the run's frozen
 * readouts onto the per-instance context from the stored meta and enqueues the
 * cockpit's view module so the card hydrates, rebuilds the drain graph and
 * auto-flips itself — the same component the dashboard shows at run end.
 */
class SessionDetail implements Manager {

	/**
	 * Stores everything needed to gate, style and render a session detail screen.
	 *
	 * @param string            $post_type   Post type sessions are stored as.
	 * @param string            $meta_prefix Prefix every session meta key carries.
	 * @param string            $capability  Capability required to view a session.
	 * @param string            $block_name  Cockpit block name, for its view-module handle.
	 * @param string            $screen_slug Listing screen slug the back link points at.
	 * @param string            $style       Stylesheet carrying the postcard styles (the cockpit stylesheet), relative to the plugin root.
	 * @param SessionDetailView $view        View that renders the summary postcard body.
	 * @param Assets            $assets      Service used to enqueue the detail stylesheet.
	 */
	public function __construct(
		private string $post_type,
		private string $meta_prefix,
		private string $capability,
		private string $block_name,
		private string $screen_slug,
		private string $style,
		private SessionDetailView $view,
		private Assets $assets
	) {
	}

	/**
	 * Hooks the editor replacement and the screen's assets. `replace_editor` runs
	 * on the post edit screen; the asset enqueue is gated to that same screen.
	 *
	 * @return void
	 */
	public function register(): void {
		add_filter( 'replace_editor', array( $this, 'maybe_render' ), 10, 2 );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Replaces the editor with the session's summary postcard when editing a
	 * session. Renders the admin header itself (the editor includes normally print
	 * it, and they are skipped here), then the detail body; returning true tells
	 * `post.php` the editor was replaced, so it prints the admin footer and stops.
	 * For any other post type the editor is left untouched.
	 *
	 * @param bool    $replace Whether the editor has already been replaced.
	 * @param WP_Post $post    The post being edited.
	 * @return bool Whether the editor was replaced.
	 */
	public function maybe_render( bool $replace, WP_Post $post ): bool {
		if ( $post->post_type !== $this->post_type || ! current_user_can( $this->capability ) ) {
			return $replace;
		}

		// `replace_editor` is applied twice: once early while WordPress sets up the
		// screen (in WP_Screen, before the `current_screen` action) merely to decide
		// block vs. classic editor, and once on the real edit pass in `post.php`.
		// Claim the replacement on both (so the block editor is never set up), but
		// render only on the real pass — rendering on the setup pass would output
		// the admin header before the menu, cookies and screen are ready, sending
		// output too early and leaving the chrome half-built.
		if ( ! did_action( 'current_screen' ) ) {
			return true;
		}

		// Blank the admin footer text on this screen only — the postcard fills the
		// whole panel, so the "Thank you for creating with WordPress" and version
		// lines have no place here. The footer element still renders (its
		// `admin_print_footer_scripts` is what prints the Interactivity module that
		// hydrates the card); only its wording is cleared.
		add_filter( 'admin_footer_text', '__return_empty_string', 11 );
		add_filter( 'update_footer', '__return_empty_string', 11 );

		require_once ABSPATH . 'wp-admin/admin-header.php';

		// The view returns finished, trusted markup — escaped slots and the seeded
		// context attribute — that no WordPress escaper can be applied to without
		// breaking it.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted view-rendered markup; see comment above.
		echo $this->view->render( $this->view_data( $post->ID ) );

		return true;
	}

	/**
	 * Enqueues the detail stylesheet and the cockpit view module on a session's
	 * edit screen, so the postcard is styled and hydrates. A no-op on every other
	 * admin screen.
	 *
	 * @param string $hook_suffix The current admin page's hook suffix.
	 * @return void
	 */
	public function enqueue( string $hook_suffix ): void {
		if ( 'post.php' !== $hook_suffix ) {
			return;
		}

		$screen = get_current_screen();

		if ( null === $screen || $screen->post_type !== $this->post_type ) {
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
			'context'            => wp_interactivity_data_wp_context( $this->context_for( $session_id ) ),
			// Empty by default; the DevTools manager (dev environments only) hooks
			// this to append its already-escaped, pre-rendered panel markup.
			'devtools_panel'     => apply_filters( 'battery_surf_bench_devtools_panel', '' ),
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
