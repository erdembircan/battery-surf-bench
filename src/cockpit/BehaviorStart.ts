/**
 * The cockpit's side of the surf engine's behavior-start handshake: recognizing
 * the `postMessage` the engine sends whenever an auction winner begins its
 * `run()`, and reading the behavior key and announced duration it carries.
 */

/** The message type the surf engine posts when a behavior starts running. */
export const BEHAVIOR_START_TYPE = 'bsb:behaviorStart';

/**
 * Whether a `message` event is a legitimate behavior-start signal from the surf
 * engine running in the viewport iframe: same-origin (the iframe only ever
 * loads the plugin's own course pages), carrying the expected message shape,
 * and carrying a finite, positive `durationMs` — the store's dismiss timer is
 * armed directly off this value, so a malformed or missing duration must never
 * reach it.
 * @param event
 * @param expectedOrigin
 */
export const isBehaviorStartMessage = (
	event: MessageEvent,
	expectedOrigin: string
): boolean => {
	if ( event.origin !== expectedOrigin ) {
		return false;
	}

	const data = event.data as { type?: unknown; durationMs?: unknown } | null;

	return (
		data?.type === BEHAVIOR_START_TYPE &&
		typeof data.durationMs === 'number' &&
		Number.isFinite( data.durationMs ) &&
		data.durationMs > 0
	);
};

/**
 * The behavior key a behavior-start message carries, or an empty string when
 * absent or not a non-empty string — the caller treats that as nothing to bark.
 * @param event
 */
export const behaviorKeyOf = ( event: MessageEvent ): string => {
	const key = ( event.data as { key?: unknown } | null )?.key;

	return typeof key === 'string' && key !== '' ? key : '';
};

/**
 * The announced wall-clock duration a behavior-start message carries, in
 * milliseconds. Only called after {@link isBehaviorStartMessage} has already
 * verified the field is a finite, positive number.
 * @param event
 */
export const durationOf = ( event: MessageEvent ): number =>
	( event.data as { durationMs: number } ).durationMs;
