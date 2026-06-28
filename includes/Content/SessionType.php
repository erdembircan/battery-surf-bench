<?php
/**
 * Benchmark session post type manager.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

use ErdemBircan\BatterySurfBench\Support\Manager;

use function __;
use function add_action;
use function current_user_can;
use function delete_option;
use function flush_rewrite_rules;
use function get_option;
use function register_post_meta;
use function register_post_type;
use function update_option;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the custom post type benchmark sessions are stored as, together
 * with the post meta that holds each session's data.
 *
 * The post type stays out of the admin menu — the plugin's own DataViews screen
 * owns the listing instead of the default list table — and out of site search,
 * but it is publicly queryable with a rewrite so each session resolves at a
 * native single-post permalink. That permalink is where the session detail route
 * renders its summary postcard; the route gates the view by capability, so the
 * URL stays admin-only despite being queryable. It also exposes REST — the
 * cockpit writes sessions through the post type's own endpoint and the listing
 * reads them back, with the registered meta riding along under `meta` so neither
 * side needs a bespoke controller.
 *
 * Because the type carries a rewrite, its rules must be flushed once after the
 * slug is first registered; activation sets a one-shot flag this manager honours
 * on the next `init`, after the type is registered (see {@see activate()}).
 *
 * The data shape itself lives in {@see SessionSchema}; this manager owns only
 * the WordPress registration and the capability policy that guards meta writes.
 */
class SessionType implements Manager {

	/**
	 * Option flag set on activation and cleared once its rewrite rules have been
	 * flushed, so the session permalink's rewrite is registered exactly once
	 * rather than on every request.
	 *
	 * @var string
	 */
	private const FLUSH_OPTION = 'bsb_flush_rewrite';

	/**
	 * Marks the session rewrite rules for a one-time flush on the next request.
	 * Called from the plugin's activation hook: the post type is not yet
	 * registered when activation runs, so the flush is deferred to the following
	 * `init`, where {@see register_post_type()} performs it once the type — and
	 * therefore its rewrite rules — exist.
	 *
	 * @return void
	 */
	public static function activate(): void {
		update_option( self::FLUSH_OPTION, '1' );
	}

	/**
	 * Stores the session schema and the capability that guards the post type.
	 *
	 * @param SessionSchema $schema     Source of the post type slug and its meta definitions.
	 * @param string        $capability Capability required to read and write sessions.
	 */
	public function __construct(
		private SessionSchema $schema,
		private string $capability
	) {
	}

	/**
	 * Hooks the post type and meta registration onto `init`, where WordPress
	 * expects content types to be declared.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_post_type' ) );
		add_action( 'init', array( $this, 'register_meta' ) );
	}

	/**
	 * Registers the headless, REST-enabled session post type.
	 *
	 * @return void
	 */
	public function register_post_type(): void {
		register_post_type( $this->schema->post_type(), $this->post_type_args() );
		$this->maybe_flush_rewrite();
	}

	/**
	 * Registers every session datum as REST-exposed post meta, attaching the
	 * capability check that guards writes to each one.
	 *
	 * @return void
	 */
	public function register_meta(): void {
		foreach ( $this->schema->metas() as $key => $args ) {
			$args['auth_callback'] = array( $this, 'can_edit' );

			register_post_meta( $this->schema->post_type(), $key, $args );
		}
	}

	/**
	 * Authorizes a meta write. WordPress passes the meta context as further
	 * arguments, but the policy is uniform: only holders of the plugin's
	 * capability may write any session meta.
	 *
	 * @return bool Whether the current user may write the meta.
	 */
	public function can_edit(): bool {
		return current_user_can( $this->capability );
	}

	/**
	 * Flushes the rewrite rules once when activation has flagged it, then clears
	 * the flag. Run from {@see register_post_type()} so the session type's rewrite
	 * rules already exist when the flush rebuilds them; a no-op on every later
	 * request, so it costs only a single option read.
	 *
	 * @return void
	 */
	private function maybe_flush_rewrite(): void {
		if ( ! get_option( self::FLUSH_OPTION ) ) {
			return;
		}

		flush_rewrite_rules();
		delete_option( self::FLUSH_OPTION );
	}

	/**
	 * Builds the post type registration arguments: a session content type that is
	 * reachable over REST, resolves at a native single-post permalink, and is
	 * gated entirely behind the plugin's capability.
	 *
	 * @return array<string, mixed> The `register_post_type` arguments.
	 */
	private function post_type_args(): array {
		return array(
			'labels'              => array(
				'name'          => __( 'Benchmark Sessions', 'battery-surf-bench' ),
				'singular_name' => __( 'Benchmark Session', 'battery-surf-bench' ),
			),
			// Stays out of the admin (the plugin's DataViews screen owns the
			// listing) and out of site search, but is publicly queryable with a
			// rewrite so each session resolves at a native single-post permalink
			// (`get_permalink()`), where the detail route renders its summary
			// postcard. The route gates that view by capability, so a session URL
			// is admin-only despite being queryable.
			'public'              => false,
			'show_ui'             => false,
			'show_in_menu'        => false,
			'show_in_rest'        => true,
			'rest_base'           => $this->schema->post_type(),
			'exclude_from_search' => true,
			'publicly_queryable'  => true,
			'has_archive'         => false,
			'rewrite'             => array(
				'slug'       => 'session',
				'with_front' => false,
			),
			'hierarchical'        => false,
			'supports'            => array( 'title', 'custom-fields' ),
			// Map every capability — meta caps included — directly onto the
			// plugin capability, with meta-cap mapping OFF. The meta caps then
			// resolve to `manage_options` as plain primitives, so checks that
			// have no specific post (e.g. the REST controller deciding whether
			// DELETE is allowed on the collection for the `Allow` header) never
			// route through `map_meta_cap`, which would demand a post and warn.
			'map_meta_cap'        => false,
			'capability_type'     => 'post',
			'capabilities'        => $this->capabilities(),
		);
	}

	/**
	 * Maps every post capability the type uses onto the plugin's single
	 * capability, so only its holders can create, read, edit or delete
	 * sessions. With meta-cap mapping disabled these values are checked as-is,
	 * so the meta caps (`edit_post`, `read_post`, `delete_post`) are mapped too.
	 *
	 * @return array<string, string> Capability map for `register_post_type`.
	 */
	private function capabilities(): array {
		$capabilities = array();

		$caps = array(
			'edit_post',
			'read_post',
			'delete_post',
			'edit_posts',
			'edit_others_posts',
			'edit_published_posts',
			'edit_private_posts',
			'publish_posts',
			'read_private_posts',
			'create_posts',
			'delete_posts',
			'delete_others_posts',
			'delete_published_posts',
			'delete_private_posts',
		);

		foreach ( $caps as $cap ) {
			$capabilities[ $cap ] = $this->capability;
		}

		return $capabilities;
	}
}
