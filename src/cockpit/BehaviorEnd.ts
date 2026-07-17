/**
 * The cockpit's side of the sterile engine's behavior-end handshake:
 * recognizing the `postMessage` a `SterileHelm` sends once a steered
 * behavior's `run()` resolves, and reading the behavior key it carries. The
 * counterpart to `./BehaviorStart` for the end of a steered run, rather than
 * the auction's own natural win.
 */

/** The message type the sterile engine posts when a steered behavior's `run()` resolves. */
export const BEHAVIOR_END_TYPE = 'bsb:behaviorEnd';

/**
 * Whether a `message` event is a legitimate behavior-end signal from the surf
 * engine running in the viewport iframe: same-origin (the iframe only ever
 * loads the plugin's own course pages) and carrying the expected message
 * shape.
 * @param event
 * @param expectedOrigin
 */
export const isBehaviorEndMessage = (
	event: MessageEvent,
	expectedOrigin: string
): boolean => {
	if ( event.origin !== expectedOrigin ) {
		return false;
	}

	const data = event.data as { type?: unknown } | null;

	return data?.type === BEHAVIOR_END_TYPE;
};

/**
 * The behavior key a behavior-end message carries, or an empty string when
 * absent or not a non-empty string.
 * @param event
 */
export const behaviorEndKeyOf = ( event: MessageEvent ): string => {
	const key = ( event.data as { key?: unknown } | null )?.key;

	return typeof key === 'string' && key !== '' ? key : '';
};
