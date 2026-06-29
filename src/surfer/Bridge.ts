/**
 * The engine's one message back to the cockpit. When a page visit finishes the
 * engine posts `bsb:page-done` to the parent frame; the cockpit advances the
 * page queue (see RunStore.initViewport). Posted with the page's own origin as
 * the target so it only ever reaches the same-origin cockpit.
 */

/** The message the engine posts to the cockpit when a page is done. */
export interface SurferMessage {
	type: 'bsb:page-done';
}

/**
 * Tells the cockpit this page is done so it can load the next one.
 * @param win The engine's window (defaults to the global).
 */
export const pageDone = ( win: Window = window ): void => {
	win.parent?.postMessage(
		{ type: 'bsb:page-done' } satisfies SurferMessage,
		win.location.origin
	);
};
