/**
 * The video page's player, as the engine drives it. The embed already autoplays
 * muted, so watching is just dwelling; a replay reloads the embed to restart it
 * from the top. Kept tiny and separate so the orchestrator stays readable.
 */

/** Drives the embedded video player on the video page. */
export class VideoWatcher {
	/**
	 * @param iframe The video embed iframe.
	 */
	constructor( private iframe: HTMLIFrameElement ) {}

	/** Restarts playback from the top by reloading the embed. */
	replay(): void {
		const src = this.iframe.getAttribute( 'src' );

		if ( src ) {
			this.iframe.setAttribute( 'src', src );
		}
	}
}
