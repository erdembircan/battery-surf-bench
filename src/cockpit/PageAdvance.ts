/**
 * The cockpit's side of the surf engine's page-done handshake: recognizing the
 * `postMessage` the engine sends when a page's surf session ends, and computing
 * the next page to surf to.
 */

/** The message type the surf engine posts when a page's surf session ends. */
export const PAGE_DONE_TYPE = 'bsb:pageDone';

/**
 * Whether a `message` event is a legitimate page-done signal from the surf
 * engine running in the viewport iframe: same-origin (the iframe only ever
 * loads the plugin's own course pages) and carrying the expected message
 * shape.
 * @param event
 * @param expectedOrigin
 */
export const isPageDoneMessage = (
	event: MessageEvent,
	expectedOrigin: string
): boolean =>
	event.origin === expectedOrigin &&
	( event.data as { type?: unknown } | null )?.type === PAGE_DONE_TYPE;

/**
 * The next page index once the current one's surf session ends, wrapping back
 * to the first page after the last. Returns the index unchanged when there
 * are no pages to surf.
 * @param activeIndex
 * @param pageCount
 */
export const nextPageIndex = (
	activeIndex: number,
	pageCount: number
): number => ( pageCount > 0 ? ( activeIndex + 1 ) % pageCount : activeIndex );
