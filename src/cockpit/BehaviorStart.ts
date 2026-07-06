/**
 * The cockpit's side of the surf engine's behavior-start handshake: recognizing
 * the `postMessage` the engine sends whenever an auction winner begins its
 * `run()`, and reading the behavior key it carries.
 */

/** The message type the surf engine posts when a behavior starts running. */
export const BEHAVIOR_START_TYPE = 'bsb:behaviorStart';

/**
 * Whether a `message` event is a legitimate behavior-start signal from the surf
 * engine running in the viewport iframe: same-origin (the iframe only ever
 * loads the plugin's own course pages) and carrying the expected message
 * shape.
 * @param event
 * @param expectedOrigin
 */
export const isBehaviorStartMessage = (
	event: MessageEvent,
	expectedOrigin: string
): boolean =>
	event.origin === expectedOrigin &&
	( event.data as { type?: unknown } | null )?.type === BEHAVIOR_START_TYPE;

/**
 * The behavior key a behavior-start message carries, or an empty string when
 * absent or not a non-empty string — the caller treats that as nothing to bark.
 * @param event
 */
export const behaviorKeyOf = ( event: MessageEvent ): string => {
	const key = ( event.data as { key?: unknown } | null )?.key;

	return typeof key === 'string' && key !== '' ? key : '';
};
