/**
 * The dev-tools panel's side of the sterile engine's steer handshake: posting
 * the `bsb:steerBehavior` command a `SterileHelm` running inside the viewport
 * iframe listens for. The only message in this feature that travels
 * cockpit → iframe (every other one — `bsb:behaviorEnd`, `bsb:pageAffordances`,
 * and the pre-existing `bsb:behaviorStart`/`bsb:pageDone` — travels the other
 * way), so unlike `./BehaviorStart`/`./BehaviorEnd`/`./PageAffordances` this
 * module builds and posts the message rather than validating one that
 * arrived. Lives alongside those for the same reason `./PageAffordances`
 * does: one place for every iframe↔cockpit message's protocol code, even
 * though its only consumer is `../devtools/SurfSteerStore`.
 */

/** The message type the dev-tools panel posts to steer a behavior. */
export const STEER_BEHAVIOR_TYPE = 'bsb:steerBehavior';

/**
 * Posts a steer command to the sterile engine running in the viewport
 * iframe, naming the behavior key to run now. A no-op when `target` is null
 * (no iframe window to post to — e.g. the viewport is absent or not yet
 * loaded).
 *
 * @param target The viewport iframe's `contentWindow` to post to, or null.
 * @param origin The page origin to post with, per `postMessage`'s required `targetOrigin`.
 * @param key    The behavior key to steer.
 */
export const postSteerBehavior = (
	target: Window | null,
	origin: string,
	key: string
): void => {
	if ( target === null ) {
		return;
	}

	target.postMessage( { type: STEER_BEHAVIOR_TYPE, key }, origin );
};
