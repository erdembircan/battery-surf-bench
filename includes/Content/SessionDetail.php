<?php
/**
 * Stored-session detail route.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

use ErdemBircan\BatterySurfBench\Cockpit\SummaryReasons;
use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\StandaloneChrome;

use function __;
use function add_action;
use function admin_url;
use function current_user_can;
use function generate_block_asset_handle;
use function get_post_meta;
use function get_queried_object_id;
use function is_singular;
use function nocache_headers;
use function status_header;
use function strtotime;
use function wp_date;
use function wp_enqueue_script_module;
use function wp_interactivity_data_wp_context;

defined( 'ABSPATH' ) || exit;

/**
 * Serves the detail page for one stored benchmark session at its native
 * single-post permalink. The session post type is publicly queryable with a
 * rewrite (see {@see SessionType}), so each session resolves at its own URL;
 * this route hooks `template_redirect`, and when the request is a single session
 * it renders the run-summary postcard as a standalone, theme-stripped document
 * and exits — the same chrome the cockpit dashboard uses.
 *
 * The view is the live cockpit's summary card ({@see SessionDetailView}) running
 * on the `bsb/cockpit` Interactivity store: this route seeds the run's frozen
 * readouts onto the per-instance context from the stored meta, enqueues the
 * cockpit's view module so the card hydrates, and lets the store rebuild the
 * drain graph and auto-flip the card on its own. Access is gated by the plugin
 * capability — a session URL 404s for anyone else, so the queryable type stays
 * private despite resolving a permalink.
 */
class SessionDetail implements Manager {

	/**
	 * Stores everything needed to resolve, gate and render a session detail page.
	 *
	 * @param string            $post_type   Post type sessions are stored as.
	 * @param string            $meta_prefix Prefix every session meta key carries.
	 * @param string            $capability  Capability required to view a session.
	 * @param string            $block_name  Cockpit block name, for its view-module handle.
	 * @param string            $screen_slug Listing screen slug the back link points at.
	 * @param CockpitDashboard  $dashboard   View that renders the standalone document shell.
	 * @param SessionDetailView $view        View that renders the summary postcard body.
	 * @param StandaloneChrome  $chrome      Strips the front end to a clean standalone document.
	 */
	public function __construct(
		private string $post_type,
		private string $meta_prefix,
		private string $capability,
		private string $block_name,
		private string $screen_slug,
		private CockpitDashboard $dashboard,
		private SessionDetailView $view,
		private StandaloneChrome $chrome
	) {
	}

	/**
	 * Hooks the detail route onto `template_redirect`, early enough to render and
	 * exit before the theme takes over — the same point the cockpit route uses.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'template_redirect', array( $this, 'maybe_render' ), 1 );
	}

	/**
	 * Renders the session detail page when the request resolves to a single
	 * session. Gated to the plugin capability — anyone else gets a 404, so a
	 * session URL reveals nothing — then strips the front end, seeds the run onto
	 * the context, enqueues the cockpit view module, and emits a standalone
	 * document built around the summary postcard, then exits.
	 *
	 * @return void
	 */
	public function maybe_render(): void {
		if ( ! is_singular( $this->post_type ) ) {
			return;
		}

		$session_id = get_queried_object_id();

		if ( 0 === $session_id || ! current_user_can( $this->capability ) ) {
			$this->not_found();
			return;
		}

		$this->chrome->engage();
		wp_enqueue_script_module( generate_block_asset_handle( $this->block_name, 'viewScriptModule' ) );

		// The summary card's directives are processed on the client by the cockpit
		// view module (the store's `state` getters live there, not server-side), so
		// the body is emitted as-is — not run through the block or directive
		// processor, which, with no server state, would resolve `state.isEnded` to
		// nothing and hide the very card the page exists to show.
		$body = $this->view->render( $this->view_data( $session_id ) );

		$document = $this->dashboard->render(
			array(
				'body'  => $body,
				'title' => __( 'Battery Surf Bench — Session', 'battery-surf-bench' ),
			)
		);

		// Both the dashboard shell and the view return a finished, trusted document
		// — escaped slots, the seeded context attribute and wp_head()/wp_footer()
		// output — that no WordPress escaper can be applied to without breaking it.
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted pre-rendered document; see comment above.
		echo $document;

		exit;
	}

	/**
	 * Turns the request into a 404 so an unauthorized visitor (or a bad id) sees
	 * the theme's not-found page rather than the session, then lets WordPress
	 * carry on to render it.
	 *
	 * @return void
	 */
	private function not_found(): void {
		global $wp_query;

		$wp_query->set_404();
		status_header( 404 );
		nocache_headers();
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
			'started_label'      => __( 'Started', 'battery-surf-bench' ),
			'started_value'      => $this->started_display( $session_id ),
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
	 * Formats the run's wall-clock start for the "Started" stat in the viewer's
	 * locale, or an em dash when the session stored no start time.
	 *
	 * @param int $session_id The session post id.
	 * @return string The localized start date, or an em dash.
	 */
	private function started_display( int $session_id ): string {
		$started_at = (string) $this->meta( $session_id, 'started_at' );
		$timestamp  = '' === $started_at ? false : strtotime( $started_at );

		if ( false === $timestamp ) {
			return '—';
		}

		return (string) wp_date( 'M j, Y · g:i A', $timestamp );
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
