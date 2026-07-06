/**
 * The engine's boot gate. Starting the tick loop before the document has
 * finished loading lets it sense an unsettled layout — `scrollRemaining` can
 * read as `0` while images are still pending, starving every scroll behavior
 * while boredom keeps accruing. Gating boot on `load` also aligns the settle
 * beat with the knowledge base's documented "1-3s settle after page load"
 * convention, rather than starting it at script execution time.
 */

/**
 * Runs `callback` once the document has fully loaded — immediately if it
 * already has.
 * @param win
 * @param callback
 */
export const whenDocumentLoaded = (
	win: Window,
	callback: () => void
): void => {
	if ( win.document.readyState === 'complete' ) {
		callback();
		return;
	}

	win.addEventListener( 'load', callback, { once: true } );
};
