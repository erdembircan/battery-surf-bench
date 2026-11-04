<?php
/**
 * Capability-gated REST controller for the benchmark sessions collection.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Content;

use WP_Error;
use WP_REST_Posts_Controller;

use function __;
use function current_user_can;
use function get_post_type_object;
use function rest_authorization_required_code;

defined( 'ABSPATH' ) || exit;

/**
 * Overrides the default posts controller so the admin-only `bsbench_session`
 * collection refuses anonymous reads.
 *
 * Core's {@see \WP_REST_Posts_Controller} treats a `view`-context list of
 * `publish` posts, and a single `publish` post, as world-readable: its
 * `get_items_permissions_check()` short-circuits to `true` for `view` context,
 * and `get_item_permissions_check()` defers to `check_read_permission()`, which
 * returns `true` for any published post — neither ever consulting the post
 * type's capability map. For an ordinary public post type that is correct, but
 * `bsbench_session` is registered admin-only ({@see SessionType}) with every
 * capability mapped onto the plugin capability, so those two read paths would
 * otherwise leak published sessions to a logged-out visitor. This subclass
 * reinstates the capability check on both reads before delegating the rest of
 * the behaviour — pagination, filtering, the {@see SessionRestQuery} hooks — to
 * core unchanged. Writes (create/update/delete) are already gated by core
 * against the same mapped capabilities and are left untouched.
 *
 * The gate reads the requirement from the post type's own capability map
 * (`edit_posts`, which {@see SessionType} maps to the plugin capability), so
 * this controller stays a single source of truth with the registration and
 * needs no injected policy — core instantiates it with only the post type slug.
 */
class SessionRestController extends WP_REST_Posts_Controller {

	/**
	 * Refuses an anonymous or under-privileged collection read, then defers to
	 * core for everything else.
	 *
	 * @param \WP_REST_Request $request Full details about the request.
	 * @return true|\WP_Error True if the read is permitted, error otherwise.
	 */
	public function get_items_permissions_check( $request ) {
		$forbidden = $this->require_capability();

		return null === $forbidden
			? parent::get_items_permissions_check( $request )
			: $forbidden;
	}

	/**
	 * Refuses an anonymous or under-privileged single-item read, then defers to
	 * core for everything else.
	 *
	 * @param \WP_REST_Request $request Full details about the request.
	 * @return true|\WP_Error True if the read is permitted, error otherwise.
	 */
	public function get_item_permissions_check( $request ) {
		$forbidden = $this->require_capability();

		return null === $forbidden
			? parent::get_item_permissions_check( $request )
			: $forbidden;
	}

	/**
	 * Enforces the post type's read capability. Returns `null` when the current
	 * user holds it (so the caller delegates to core), or a `rest_forbidden`
	 * error carrying the status code core uses for authorization failures — 401
	 * for a logged-out request, 403 for a logged-in one lacking the capability.
	 *
	 * @return \WP_Error|null The refusal error, or null when permitted.
	 */
	private function require_capability(): ?WP_Error {
		$post_type = get_post_type_object( $this->post_type );

		if ( $post_type && current_user_can( $post_type->cap->edit_posts ) ) {
			return null;
		}

		return new WP_Error(
			'rest_forbidden',
			__( 'Sorry, you are not allowed to view benchmark sessions.', 'battery-surf-bench' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}
}
