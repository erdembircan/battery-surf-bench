/**
 * The Konami code recognizer behind the cockpit's shark-fin Easter egg. Pure
 * over an injected progress counter and the next key pressed — no DOM, no
 * Interactivity runtime, unit-testable in isolation (same philosophy as
 * {@link ./Barks}).
 */

/**
 * The sequence a visitor must enter, in order, to release the shark: the
 * classic Konami code, lowercased so a match is case-insensitive.
 */
export const KONAMI_SEQUENCE: readonly string[] = [
	'arrowup',
	'arrowup',
	'arrowdown',
	'arrowdown',
	'arrowleft',
	'arrowright',
	'arrowleft',
	'arrowright',
	'b',
	'a',
];

/**
 * The longest gap allowed between two consecutive keys of the sequence, in
 * milliseconds. A slower gap starts the sequence over.
 */
export const KONAMI_TIMEOUT_MS = 300;

/**
 * Advances (or resets) the sequence progress for one keypress. A gap since
 * the previous key longer than {@link KONAMI_TIMEOUT_MS} starts the sequence
 * over first — but a stale gap doesn't just fail the match outright: the key
 * just pressed is still free to BEGIN a fresh sequence, e.g. an `ArrowUp`
 * arriving after a long pause yields progress `1`, same as any other fresh
 * start. A match at the (possibly reset) position moves the progress forward
 * by one; a mismatch resets to a fresh start (`1`) when the key itself
 * matches the sequence's first element, or all the way back to `0`
 * otherwise.
 *
 * @param progress  How many leading keys of the sequence have matched so far.
 * @param key       The key just pressed, matched case-insensitively.
 * @param elapsedMs Milliseconds since the previous key was pressed.
 * @return The next progress count.
 */
export const nextKonamiProgress = (
	progress: number,
	key: string,
	elapsedMs: number
): number => {
	const lowered = key.toLowerCase();
	const effective = elapsedMs > KONAMI_TIMEOUT_MS ? 0 : progress;

	if ( lowered === KONAMI_SEQUENCE[ effective ] ) {
		return effective + 1;
	}

	return lowered === KONAMI_SEQUENCE[ 0 ] ? 1 : 0;
};

/**
 * Whether the sequence has been entered in full.
 *
 * @param progress How many leading keys of the sequence have matched so far.
 * @return Whether the whole sequence has matched.
 */
export const isKonamiComplete = ( progress: number ): boolean =>
	progress >= KONAMI_SEQUENCE.length;
