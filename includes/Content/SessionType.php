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
use function register_post_meta;
use function register_post_type;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the custom post type benchmark sessions are stored as, together
 * with the post meta that holds each session's data.
 *
 * The post type is deliberately headless: it has no public archive and no
 * front-end of its own, and it is kept out of the admin menu so the plugin's
 * own DataViews screen owns the listing instead of the default list table. What
 * it does expose is REST — the cockpit writes sessions through the post type's
 * own endpoint and the listing reads them back, with the registered meta riding
 * along under `meta` so neither side needs a bespoke controller.
 *
 * The data shape itself lives in {@see SessionSchema}; this manager owns only
 * the WordPress registration and the capability policy that guards meta writes.
 */
class SessionType implements Manager {

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
	 * Builds the post type registration arguments: a headless content type that
	 * is reachable over REST and gated entirely behind the plugin's capability.
	 *
	 * @return array<string, mixed> The `register_post_type` arguments.
	 */
	private function post_type_args(): array {
		return array(
			'labels'              => array(
				'name'          => __( 'Benchmark Sessions', 'battery-surf-bench' ),
				'singular_name' => __( 'Benchmark Session', 'battery-surf-bench' ),
			),
			'public'              => false,
			'show_ui'             => false,
			'show_in_menu'        => false,
			'show_in_rest'        => true,
			'rest_base'           => $this->schema->post_type(),
			'exclude_from_search' => true,
			'publicly_queryable'  => false,
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
