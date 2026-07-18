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
 * Advances (or resets) the sequence progress for one keypress. Strictly
 * all-or-nothing: one wrong key resets progress all the way back to `0`, with
 * no exception for a mismatched key that happens to equal the sequence's own
 * first element — the only way to make progress is entering the sequence
 * correctly from the start. A gap since the previous key longer than
 * {@link KONAMI_TIMEOUT_MS} resets the effective progress to `0` before
 * matching, so a correct first key pressed after a long pause still yields
 * `1` — that is simply a fresh attempt entered correctly from the top, not a
 * mismatch credit. A match at the (possibly reset) position moves the
 * progress forward by one; anything else is `0`.
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

	return lowered === KONAMI_SEQUENCE[ effective ] ? effective + 1 : 0;
};

/**
 * Whether the sequence has been entered in full.
 *
 * @param progress How many leading keys of the sequence have matched so far.
 * @return Whether the whole sequence has matched.
 */
export const isKonamiComplete = ( progress: number ): boolean =>
	progress >= KONAMI_SEQUENCE.length;
